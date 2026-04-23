#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
#
# nexasign-retention-check — Prüft Aufbewahrungs-Fristen signierter Envelopes
#                            gemäß § 147 AO / § 257 HGB (10 Jahre GoBD).
#
# Funktion:
#   - Liste aller COMPLETED-Envelopes
#   - Alter seit completedAt
#   - Kategorisierung: OK / BALD-ABLAUFEND (9-10 Jahre) / ABGELAUFEN (>10 Jahre)
#   - Bericht in /var/log/nexasign/retention-check.log
#
# Löscht NICHTS. Meldet nur. Endgültiges Löschen nach Fristablauf
# ist bewusst Entscheidung des Admins (nicht automatisiert).
#
# Einsatz: als systemd-timer, täglich 03:00 Uhr.
#

set -euo pipefail

DB_CONTAINER="nexasign-db"
DB_USER="nexasign"
DB_NAME="nexasign"
LOG_DIR="/var/log/nexasign"
LOG_FILE="$LOG_DIR/retention-check.log"
RETENTION_YEARS=10
WARN_YEARS=9     # Envelopes ab diesem Alter werden als "bald ablaufend" gemeldet

mkdir -p "$LOG_DIR"
exec >>"$LOG_FILE" 2>&1

echo "────────────────────────────────────────────────"
echo "[$(date -Iseconds)] Retention-Check gestartet"

# Alle COMPLETED-Envelopes mit Alter abrufen
RESULT=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -At -F $'\t' --pset=footer=off -c "
  SELECT
    id,
    title,
    \"completedAt\"::date,
    EXTRACT(DAY FROM (NOW() - \"completedAt\")) AS days_old
  FROM \"Envelope\"
  WHERE status = 'COMPLETED'
    AND \"completedAt\" IS NOT NULL
  ORDER BY \"completedAt\"
")

TOTAL=0
EXPIRED=0
WARNING=0
OK=0

while IFS=$'\t' read -r ID TITLE COMPLETED DAYS; do
  [[ -z "$ID" ]] && continue
  TOTAL=$((TOTAL + 1))
  YEARS=$(( DAYS / 365 ))

  if   [[ "$YEARS" -ge "$RETENTION_YEARS" ]]; then
    EXPIRED=$((EXPIRED + 1))
    echo "  [ABGELAUFEN] $ID — '$TITLE' — completedAt=$COMPLETED — Alter=${YEARS}J"
  elif [[ "$YEARS" -ge "$WARN_YEARS" ]]; then
    WARNING=$((WARNING + 1))
    echo "  [WARNUNG]    $ID — '$TITLE' — completedAt=$COMPLETED — Alter=${YEARS}J (läuft in ${DAYS_LEFT:-?} Tagen ab)"
  else
    OK=$((OK + 1))
  fi
done <<< "$RESULT"

echo "Zusammenfassung:"
echo "  Gesamt:          $TOTAL COMPLETED-Envelopes"
echo "  OK (<${WARN_YEARS}J):       $OK"
echo "  Bald ablaufend:  $WARNING (zwischen ${WARN_YEARS}J und ${RETENTION_YEARS}J)"
echo "  Abgelaufen:      $EXPIRED (≥${RETENTION_YEARS}J — Admin kann endgültig archivieren)"
echo "[$(date -Iseconds)] Retention-Check beendet"
echo ""

# Exit-Code signalisiert „action required": 1 wenn abgelaufen, 0 sonst
[[ "$EXPIRED" -gt 0 ]] && exit 1 || exit 0
