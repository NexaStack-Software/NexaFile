#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
#
# nexasign-gobd-export — Exportiert signierte Dokumente + Audit-Log + PDF-Binaries
#                        als ZIP-Paket mit SHA-256-Manifest für GoBD-Betriebsprüfung
#                        (§ 147 Abs. 6 AO, Z2/Z3).
#
# Phase 2 (Stand 2026-04-21):
#   - Envelope-Metadaten (CSV)
#   - DocumentAuditLog (CSV)
#   - PDF-Binaries pro Envelope (documents/<envelopeId>/<n>_<title>.pdf)
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
set -euo pipefail

VON="${1:-}"
BIS="${2:-}"
ZIEL="${3:-}"

if [[ -z "$VON" || -z "$BIS" || -z "$ZIEL" ]]; then
  echo "Nutzung: $0 <VON> <BIS> <ZIEL-DIR>"
  echo "  VON/BIS im Format YYYY-MM-DD"
  exit 1
fi

DB_CONTAINER="nexasign-db"
DB_USER="nexasign"
DB_NAME="nexasign"

mkdir -p "$ZIEL/documents"
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
# 3. PDF-Binaries pro Envelope
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
# 4. SHA-256-Manifest über alle Dateien (außer manifest selbst + ZIP)
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
# 5. README.md
# ─────────────────────────────────────────────────────────────────
cat > "$ZIEL/README.md" <<EOF
# NexaSign GoBD-Export

**Zeitraum:** $VON bis $BIS
**Erzeugt:** $(date -Iseconds)
**Tool:** \`nexasign-gobd-export\` (Phase 2, 2026-04)

## Paket-Inhalt

- \`envelopes.csv\` — Metadaten der im Zeitraum abgeschlossen signierten Envelopes ($N_ENV Stück)
- \`audit-log.csv\` — Vollständiger Audit-Trail im Zeitraum ($N_AUDIT Events)
- \`documents/<envelope-id>/<order>_<title>.pdf\` — PDF-Binaries aller signierten Dokumente ($N_PDF Dateien)
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

---

NexaSign / NexaStack · AGPL-3.0 · Keine Rechtsberatung.
EOF

# ─────────────────────────────────────────────────────────────────
# 6. ZIP
# ─────────────────────────────────────────────────────────────────
ZIPNAME="nexasign-gobd-export_${VON}_${BIS}.zip"
(cd "$ZIEL" && zip -q -r "$ZIPNAME" . -x "$ZIPNAME")
SIZE=$(du -h "$ZIEL/$ZIPNAME" | cut -f1)
echo "  → $ZIPNAME ($SIZE)"

echo "[$(date -Iseconds)] Export abgeschlossen: $ZIEL/$ZIPNAME"
