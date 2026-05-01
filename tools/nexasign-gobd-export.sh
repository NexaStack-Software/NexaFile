#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
#
# nexasign-gobd-export — Exportiert signierte Dokumente, gefundene Belege,
#                        Audit-Logs und PDF-/Mail-Artefakte als ZIP-Paket
#                        mit SHA-256-Manifest für GoBD-Betriebsprüfung
#                        (§ 147 Abs. 6 AO, Z2/Z3).
#
# V1 (Stand 2026-04-30):
#   - Envelope-Metadaten + DocumentAuditLog (CSV)
#   - DiscoveryDocument-Metadaten + DiscoveryAuditLog (CSV)
#   - PDF-Binaries pro Envelope (documents/<envelopeId>/<n>_<title>.pdf)
#   - Mail-/Anhang-Artefakte pro gefundenem Beleg (discovery/<documentId>/...)
#   - SHA-256-Manifest (manifest.sha256)
#   - README.md mit rechtlichem Kontext
#
# Noch offen (Phase 3):
#   - GPG-Signatur des gesamten Pakets
#   - Separat-Export der originalen PDFs (initialData) vs. nach-Signatur (data)
#
# Nutzung:  sudo bash nexasign-gobd-export.sh <VON> <BIS> <ZIEL-DIR>
#   z. B.:  sudo bash nexasign-gobd-export.sh 2026-01-01 2026-12-31 /tmp/gobd-2026
#
# Optional:
#   NEXASIGN_DISCOVERY_ARCHIVE_PATH=/var/lib/nexasign-archive
#   Host-Pfad des Discovery-Archivs. Im Container ist das normalerweise
#   /var/lib/nexasign/sources, auf dem Host /var/lib/nexasign-archive.
#
set -euo pipefail

VON="${1:-}"
BIS="${2:-}"
ZIEL="${3:-}"

if [[ -z "$VON" || -z "$BIS" || -z "$ZIEL" ]]; then
  echo "Nutzung: $0 <VON> <BIS> <ZIEL-DIR>"
  echo "  VON/BIS im Format YYYY-MM-DD"
  exit 1
fi

if [[ ! "$VON" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ || ! "$BIS" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "FEHLER: VON/BIS müssen im Format YYYY-MM-DD angegeben werden." >&2
  exit 2
fi

if ! date -d "$VON" >/dev/null 2>&1 || ! date -d "$BIS" >/dev/null 2>&1; then
  echo "FEHLER: VON/BIS enthalten kein gültiges Datum." >&2
  exit 2
fi

if [[ "$VON" > "$BIS" ]]; then
  echo "FEHLER: VON darf nicht nach BIS liegen." >&2
  exit 2
fi

DB_CONTAINER="nexasign-db"
DB_USER="nexasign"
DB_NAME="nexasign"
DISCOVERY_ARCHIVE_BASE="${NEXASIGN_DISCOVERY_ARCHIVE_PATH:-/var/lib/nexasign-archive}"

mkdir -p "$ZIEL/documents" "$ZIEL/discovery"
echo "[$(date -Iseconds)] Export startet: $VON bis $BIS → $ZIEL"

# Helper: psql im Container mit tab-separated, ohne Header/Footer, nur die Daten
psql_raw() {
  docker exec -i "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -At -F $'\t' --pset=footer=off "$@"
}

# ─────────────────────────────────────────────────────────────────
# 1. Envelope-Metadaten
# ─────────────────────────────────────────────────────────────────
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "COPY (
        SELECT id, \"secondaryId\", title, status, \"createdAt\", \"completedAt\", \"userId\", \"teamId\"
        FROM \"Envelope\"
        WHERE status = 'COMPLETED'
          AND \"completedAt\" BETWEEN '$VON' AND '$BIS 23:59:59'
        ORDER BY \"completedAt\"
      ) TO STDOUT WITH CSV HEADER" \
  > "$ZIEL/envelopes.csv"
N_ENV=$(( $(wc -l < "$ZIEL/envelopes.csv") - 1 ))
echo "  → envelopes.csv ($N_ENV signierte Envelopes)"

# ─────────────────────────────────────────────────────────────────
# 2. Audit-Log
# ─────────────────────────────────────────────────────────────────
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "COPY (
        SELECT id, \"envelopeId\", \"userId\", name, email, type,
               \"createdAt\", \"ipAddress\", \"userAgent\", data
        FROM \"DocumentAuditLog\"
        WHERE \"createdAt\" BETWEEN '$VON' AND '$BIS 23:59:59'
        ORDER BY \"envelopeId\", \"createdAt\"
      ) TO STDOUT WITH CSV HEADER" \
  > "$ZIEL/audit-log.csv"
N_AUDIT=$(( $(wc -l < "$ZIEL/audit-log.csv") - 1 ))
echo "  → audit-log.csv ($N_AUDIT Events)"

# ─────────────────────────────────────────────────────────────────
# 3. Gefundene/akzeptierte Belege
#    acceptedAt ist der GoBD-Retention-Start fuer DiscoveryDocument.
# ─────────────────────────────────────────────────────────────────
docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "COPY (
        SELECT id, title, correspondent, status, \"providerSource\", \"providerNativeId\",
               \"documentDate\", \"capturedAt\", \"acceptedAt\", \"acceptedById\", \"sourceId\",
               \"detectedAmount\", \"detectedInvoiceNumber\", \"archivePath\", \"signingEnvelopeId\"
        FROM \"DiscoveryDocument\"
        WHERE \"acceptedAt\" IS NOT NULL
          AND \"acceptedAt\" BETWEEN '$VON' AND '$BIS 23:59:59'
        ORDER BY \"acceptedAt\", \"capturedAt\"
      ) TO STDOUT WITH CSV HEADER" \
  > "$ZIEL/discovery-documents.csv"
N_DISCOVERY=$(( $(wc -l < "$ZIEL/discovery-documents.csv") - 1 ))
echo "  → discovery-documents.csv ($N_DISCOVERY akzeptierte Belege)"

docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "COPY (
        SELECT id, event, \"sourceId\", \"discoveryDocumentId\", \"userId\", \"teamId\",
               metadata, \"createdAt\"
        FROM \"DiscoveryAuditLog\"
        WHERE \"createdAt\" BETWEEN '$VON' AND '$BIS 23:59:59'
        ORDER BY \"discoveryDocumentId\", \"createdAt\"
      ) TO STDOUT WITH CSV HEADER" \
  > "$ZIEL/discovery-audit-log.csv"
N_DISCOVERY_AUDIT=$(( $(wc -l < "$ZIEL/discovery-audit-log.csv") - 1 ))
echo "  → discovery-audit-log.csv ($N_DISCOVERY_AUDIT Events)"

docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "COPY (
        SELECT d.id, d.title, d.status, d.\"providerSource\", d.\"providerNativeId\",
               d.\"acceptedAt\", d.\"archivePath\", COUNT(a.id) AS \"artifactCount\",
               CASE
                 WHEN d.\"archivePath\" IS NULL OR d.\"archivePath\" = '' THEN 'NO_ARCHIVE_PATH'
                 WHEN COUNT(a.id) = 0 THEN 'NO_ARTIFACT_ROWS'
                 ELSE 'OK'
               END AS reason
        FROM \"DiscoveryDocument\" d
        LEFT JOIN \"DiscoveryArtifact\" a ON a.\"discoveryDocumentId\" = d.id
        WHERE d.\"acceptedAt\" IS NOT NULL
          AND d.\"acceptedAt\" BETWEEN '$VON' AND '$BIS 23:59:59'
        GROUP BY d.id
        HAVING d.\"archivePath\" IS NULL OR d.\"archivePath\" = '' OR COUNT(a.id) = 0
        ORDER BY d.\"acceptedAt\", d.\"capturedAt\"
      ) TO STDOUT WITH CSV HEADER" \
  > "$ZIEL/discovery-missing-artifacts.csv"
N_DISCOVERY_MISSING=$(( $(wc -l < "$ZIEL/discovery-missing-artifacts.csv") - 1 ))
echo "  → discovery-missing-artifacts.csv ($N_DISCOVERY_MISSING Belege ohne Mail-Artefakte)"

# ─────────────────────────────────────────────────────────────────
# 4. Mail-/Anhang-Artefakte pro akzeptiertem Beleg
# ─────────────────────────────────────────────────────────────────
N_DISCOVERY_FILES=0
N_DISCOVERY_SKIPPED=0
ARTIFACTS_TSV=$(psql_raw -c "
  SELECT d.id, d.\"archivePath\", a.kind, a.\"fileName\", a.\"relativePath\", a.sha256
  FROM \"DiscoveryDocument\" d
  JOIN \"DiscoveryArtifact\" a ON a.\"discoveryDocumentId\" = d.id
  WHERE d.\"acceptedAt\" IS NOT NULL
    AND d.\"acceptedAt\" BETWEEN '$VON' AND '$BIS 23:59:59'
  ORDER BY d.id, a.\"createdAt\"
")

while IFS=$'\t' read -r DOC_ID ARCHIVE_PATH ART_KIND FILE_NAME REL_PATH EXPECTED_SHA; do
  [[ -z "$DOC_ID" ]] && continue

  if [[ -z "$ARCHIVE_PATH" || -z "$REL_PATH" ]]; then
    echo "    ⚠ Discovery-Artefakt ohne Pfad übersprungen: doc=$DOC_ID kind=$ART_KIND file=$FILE_NAME"
    N_DISCOVERY_SKIPPED=$((N_DISCOVERY_SKIPPED + 1))
    continue
  fi

  case "$ARCHIVE_PATH" in
    /*|*..* )
      echo "    ⚠ Unsicherer archivePath übersprungen: doc=$DOC_ID path=$ARCHIVE_PATH"
      N_DISCOVERY_SKIPPED=$((N_DISCOVERY_SKIPPED + 1))
      continue
      ;;
  esac

  case "$REL_PATH" in
    /*|*..* )
      echo "    ⚠ Unsicherer relativePath übersprungen: doc=$DOC_ID path=$REL_PATH"
      N_DISCOVERY_SKIPPED=$((N_DISCOVERY_SKIPPED + 1))
      continue
      ;;
  esac

  SRC="$DISCOVERY_ARCHIVE_BASE/$ARCHIVE_PATH/$REL_PATH"
  DEST="$ZIEL/discovery/$DOC_ID/$REL_PATH"

  if [[ ! -f "$SRC" ]]; then
    echo "    ⚠ Discovery-Artefakt nicht gefunden: $SRC"
    N_DISCOVERY_SKIPPED=$((N_DISCOVERY_SKIPPED + 1))
    continue
  fi

  mkdir -p "$(dirname "$DEST")"
  cp -p "$SRC" "$DEST"

  ACTUAL_SHA=$(sha256sum "$DEST" | awk '{print $1}')
  if [[ -n "$EXPECTED_SHA" && "$ACTUAL_SHA" != "$EXPECTED_SHA" ]]; then
    echo "    ⚠ Hash-Abweichung bei $DEST (DB=$EXPECTED_SHA, Datei=$ACTUAL_SHA)"
    rm -f "$DEST"
    N_DISCOVERY_SKIPPED=$((N_DISCOVERY_SKIPPED + 1))
    continue
  fi

  N_DISCOVERY_FILES=$((N_DISCOVERY_FILES + 1))
done <<< "$ARTIFACTS_TSV"

echo "  → discovery/ ($N_DISCOVERY_FILES Mail-/Anhang-Dateien exportiert, $N_DISCOVERY_SKIPPED übersprungen)"

# ─────────────────────────────────────────────────────────────────
# 5. PDF-Binaries pro Envelope
#    Jedes EnvelopeItem verweist auf DocumentData.data (Base64-kodiertes PDF).
# ─────────────────────────────────────────────────────────────────
N_PDF=0
# Liste der EnvelopeItems für den Zeitraum holen
ITEMS_TSV=$(psql_raw -c "
  SELECT e.id, ei.id, ei.\"order\", ei.title, ei.\"documentDataId\"
  FROM \"Envelope\" e
  JOIN \"EnvelopeItem\" ei ON ei.\"envelopeId\" = e.id
  WHERE e.status = 'COMPLETED'
    AND e.\"completedAt\" BETWEEN '$VON' AND '$BIS 23:59:59'
  ORDER BY e.id, ei.\"order\"
")

while IFS=$'\t' read -r ENV_ID ITEM_ID ITEM_ORDER ITEM_TITLE DD_ID; do
  [[ -z "$ENV_ID" ]] && continue

  # Sicherer Dateiname: nicht-alphanumerische Zeichen → _
  SAFE_TITLE=$(echo "$ITEM_TITLE" | tr -cd '[:alnum:]._-' | cut -c1-80)
  [[ -z "$SAFE_TITLE" ]] && SAFE_TITLE="dokument"
  ENV_DIR="$ZIEL/documents/$ENV_ID"
  mkdir -p "$ENV_DIR"
  OUT="$ENV_DIR/$(printf '%02d' "$ITEM_ORDER")_${SAFE_TITLE}.pdf"

  # Base64-Daten holen und dekodieren
  psql_raw -c "SELECT data FROM \"DocumentData\" WHERE id = '$DD_ID'" \
    | base64 -d > "$OUT" 2>/dev/null || {
      echo "    ⚠ Konnte $DD_ID nicht dekodieren — übersprungen"
      rm -f "$OUT"
      continue
    }

  # Sanity-Check: beginnt mit %PDF?
  if head -c 4 "$OUT" | grep -q "%PDF"; then
    N_PDF=$((N_PDF + 1))
  else
    echo "    ⚠ $OUT ist kein valides PDF — entfernt"
    rm -f "$OUT"
  fi
done <<< "$ITEMS_TSV"

echo "  → documents/ ($N_PDF PDF-Dateien exportiert)"

# ─────────────────────────────────────────────────────────────────
# 6. README.md
# ─────────────────────────────────────────────────────────────────
cat > "$ZIEL/README.md" <<EOF
# NexaFile GoBD-Export

**Zeitraum:** $VON bis $BIS
**Erzeugt:** $(date -Iseconds)
**Tool:** \`nexasign-gobd-export\` (V1, 2026-04)

## Paket-Inhalt

- \`envelopes.csv\` — Metadaten der im Zeitraum abgeschlossen signierten Envelopes ($N_ENV Stück)
- \`audit-log.csv\` — Audit-Trail der Signatur-Dokumente im Zeitraum ($N_AUDIT Events)
- \`discovery-documents.csv\` — akzeptierte gefundene Belege im Zeitraum, nach \`acceptedAt\` ($N_DISCOVERY Stück)
- \`discovery-audit-log.csv\` — Audit-Trail der Quellen-/Belegsuche im Zeitraum ($N_DISCOVERY_AUDIT Events)
- \`discovery-missing-artifacts.csv\` — akzeptierte Belege ohne exportierbare Mail-/Anhang-Artefakte ($N_DISCOVERY_MISSING Stück)
- \`documents/<envelope-id>/<order>_<title>.pdf\` — PDF-Binaries aller signierten Dokumente ($N_PDF Dateien)
- \`discovery/<discovery-document-id>/...\` — gespeicherte E-Mails, Body-Dateien, Metadaten und Anhänge ($N_DISCOVERY_FILES Dateien)
- \`manifest.sha256\` — SHA-256-Hashes aller enthaltenen Dateien (Integritätsnachweis)
- \`README.md\` — diese Datei

## Integrität prüfen

\`\`\`bash
cd <entpacktes-verzeichnis>
sha256sum -c manifest.sha256
\`\`\`

Jede Zeile sollte mit \`: OK\` enden. Bei \`FAILED\`-Einträgen ist eine Datei nach dem Export
verändert worden — dann liegt das Integritätsproblem beim Empfänger, nicht bei NexaSign.

## Rechtlicher Kontext

Dieses Paket unterstützt den **Z2-Zugriff** (mittelbarer Datenzugriff) bzw. **Z3**
(Datenträgerüberlassung) gemäß **§ 147 Abs. 6 AO**. Die GoBD-Gesamtkonformität
(Verfahrensdokumentation, Archivierungs-Prozesse, Backup-Strategie) verantwortet
der/die Steuerpflichtige.

Die enthaltenen PDFs sind die **nach Abschluss des Signatur-Vorgangs** gespeicherten
Versionen aus der \`DocumentData.data\`-Spalte — also mit eingebetteten Signaturen
und Fields. Die Original-Uploads (\`initialData\`) werden in diesem Paket nicht
separat exportiert.

Gefundene Belege aus „Dokumente finden" werden aufgenommen, sobald sie in NexaFile
akzeptiert wurden (\`acceptedAt\`). Die zugehörigen Mail-/Anhang-Dateien werden aus
\`$DISCOVERY_ARCHIVE_BASE\` kopiert. Falls Dateien im Export fehlen, prüfen Sie den
Server-Pfad, die Warnungen in der Konsolen-Ausgabe dieses Exports und
\`discovery-missing-artifacts.csv\`. Altimporte ohne Archive können in der App per
„Erneut aus IMAP laden" nachgefüttert werden.

---

NexaFile / NexaStack · AGPL-3.0 · Keine Rechtsberatung.
EOF

# ─────────────────────────────────────────────────────────────────
# 7. SHA-256-Manifest über alle Dateien (außer manifest selbst + ZIP)
# ─────────────────────────────────────────────────────────────────
(
  cd "$ZIEL"
  find . -type f ! -name 'manifest.sha256' ! -name '*.zip' -print0 \
    | xargs -0 sha256sum \
    | sort -k2 \
    > manifest.sha256
)
echo "  → manifest.sha256 ($(wc -l < "$ZIEL/manifest.sha256") Einträge)"

# ─────────────────────────────────────────────────────────────────
# 8. ZIP
# ─────────────────────────────────────────────────────────────────
ZIPNAME="nexasign-gobd-export_${VON}_${BIS}.zip"
(cd "$ZIEL" && zip -q -r "$ZIPNAME" . -x "$ZIPNAME")
SIZE=$(du -h "$ZIEL/$ZIPNAME" | cut -f1)
echo "  → $ZIPNAME ($SIZE)"

echo "[$(date -Iseconds)] Export abgeschlossen: $ZIEL/$ZIPNAME"
