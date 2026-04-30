#!/usr/bin/env bash
# NexaSign — Deploy der nginx-Config aus dem Repo nach /etc/nginx/sites-enabled.
#
# Source-of-truth ist deploy/nginx/nexasign.nexastack.co.conf im Repo.
# Live-Pfad ist /etc/nginx/sites-enabled/nexasign.nexastack.co. Dieses Skript
# kopiert den Repo-Stand auf den Live-Pfad (mit Backup), prueft die Syntax und
# reloadet nginx — atomar, mit Rollback bei Fehler.
#
# Aufruf:  sudo bash scripts/nexasign/deploy-nginx-config.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE="${REPO_ROOT}/deploy/nginx/nexasign.nexastack.co.conf"
TARGET="/etc/nginx/sites-enabled/nexasign.nexastack.co"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "FEHLER: Skript muss als root laufen (sudo)." >&2
  exit 1
fi

if [[ ! -f "${SOURCE}" ]]; then
  echo "FEHLER: Repo-Source fehlt: ${SOURCE}" >&2
  exit 1
fi

if [[ ! -f "${TARGET}" ]]; then
  echo "FEHLER: Live-Target existiert nicht (erst-Setup haendisch?): ${TARGET}" >&2
  exit 1
fi

# Diff anzeigen, falls vorhanden
if ! diff -q "${TARGET}" "${SOURCE}" >/dev/null 2>&1; then
  echo "Diff zwischen live und repo:"
  diff -u "${TARGET}" "${SOURCE}" || true
  echo
fi

# Backup mit Zeitstempel — NICHT in sites-enabled/ legen, weil nginx sonst die
# Backup-Datei mitlaedt und z. B. doppelte `listen :443`-Direktiven zu einem
# emerg-Fehler fuehren. Backups landen unter /var/backups/nginx/.
BACKUP_DIR="/var/backups/nginx"
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
BACKUP="${BACKUP_DIR}/$(basename "${TARGET}").bak.$(date +%s)"
cp -p "${TARGET}" "${BACKUP}"
echo "Backup erstellt: ${BACKUP}"

# Atomar via Move auf gleichem FS
TEMP="${TARGET}.new"
cp -p "${SOURCE}" "${TEMP}"
mv "${TEMP}" "${TARGET}"
echo "Deployed: ${SOURCE} → ${TARGET}"

# Vor Syntax-Check: alte Stray-Backups aus sites-enabled/ wegraeumen, sonst
# laedt nginx sie mit und erkennt z. B. doppelte listen-Direktiven.
STRAY_BACKUPS=$(find "$(dirname "${TARGET}")" -maxdepth 1 -type f -name "$(basename "${TARGET}").bak.*" 2>/dev/null || true)
if [[ -n "${STRAY_BACKUPS}" ]]; then
  echo "Verschiebe Alt-Backups aus sites-enabled/ nach ${BACKUP_DIR}:"
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    mv "$f" "${BACKUP_DIR}/$(basename "$f")"
    echo "  $f → ${BACKUP_DIR}/$(basename "$f")"
  done <<< "${STRAY_BACKUPS}"
fi

# Syntax pruefen — bei Fehler Rollback
if ! nginx -t 2>&1; then
  echo "FEHLER: nginx -t schlug fehl. Rollback…" >&2
  cp "${BACKUP}" "${TARGET}"
  nginx -t >&2 || true
  exit 1
fi

# Reload (kein restart) — bestehende Verbindungen bleiben erhalten
systemctl reload nginx
echo "nginx reloaded."
