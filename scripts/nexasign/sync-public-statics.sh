#!/usr/bin/env bash
# NexaSign — Sync der statischen Public-Assets in den nginx-Static-Pfad.
#
# Hintergrund: Der nginx-Server-Block fuer nexasign.nexastack.co liefert
# /logo-(1x|2x).(png|webp) NICHT aus dem Remix-Container, sondern direkt aus
# /var/www/nexasign/ (statisch, ohne proxy_pass) — damit dieselben Logos auch
# fuer die PHP-/vorlagen/-Seiten verfuegbar sind, ohne den Container-Build zu
# beruehren. Damit /var/www/nexasign/ nach jedem Source-Update nicht aus dem
# Repo driftet, gibt es genau dieses Skript.
#
# Idempotent. Kopiert byte-genau aus apps/remix/public/. Eigentumsrechte
# folgen der nginx-Worker-Konvention (www-data:www-data, 0644).
#
# Aufruf vom Repo-Root:
#   sudo bash scripts/nexasign/sync-public-statics.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SOURCE_DIR="${REPO_ROOT}/apps/remix/public"
TARGET_DIR="${NEXASIGN_NGINX_STATIC_DIR:-/var/www/nexasign}"

if [[ ! -d "${SOURCE_DIR}" ]]; then
  echo "FEHLER: Source-Verzeichnis fehlt: ${SOURCE_DIR}" >&2
  exit 1
fi

if [[ ! -d "${TARGET_DIR}" ]]; then
  echo "FEHLER: Ziel-Verzeichnis fehlt: ${TARGET_DIR}" >&2
  echo "Hinweis: nginx-Server-Block muss /var/www/nexasign/ als root fuer" >&2
  echo "         /logo-*.{png,webp} eingetragen haben." >&2
  exit 1
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "FEHLER: Skript muss als root laufen (sudo)." >&2
  exit 1
fi

echo "Sync ${SOURCE_DIR}/  →  ${TARGET_DIR}/"
echo

# Logos sind die einzigen Files, die nginx aus diesem Pfad ausliefert.
# Favicons gehen ueber proxy_pass an die App und liegen NICHT in /var/www/.
ASSETS=(
  logo-1x.png
  logo-1x.webp
  logo-2x.png
  logo-2x.webp
)

for f in "${ASSETS[@]}"; do
  src="${SOURCE_DIR}/${f}"
  dst="${TARGET_DIR}/${f}"

  if [[ ! -f "${src}" ]]; then
    echo "  SKIP   ${f}  (im Repo nicht vorhanden)"
    continue
  fi

  install -o www-data -g www-data -m 0644 "${src}" "${dst}"
  size="$(stat -c %s "${dst}")"
  printf "  WROTE  %-20s  %s bytes\n" "${f}" "${size}"
done

echo
echo "Done. nginx serviert ab sofort die neuen Logos aus ${TARGET_DIR}/."
