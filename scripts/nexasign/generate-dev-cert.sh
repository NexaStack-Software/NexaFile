#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
#
# Erzeugt ein Self-signed PKCS#12 Signatur-Zertifikat für den NexaSign-Docker-Stack
# und legt es ins nexasign-cert-Volume unter /opt/nexasign/cert.p12 ab.
#
# NUR für Entwicklung und Test-Setups. Für Produktivbetrieb siehe SIGNING.nexasign.md
# (Stichwort: AATL-vertrauenswürdiges Document-Signing-Cert von Certum / Sectigo /
# GlobalSign / D-Trust — ohne das zeigen alle PDF-Viewer „Identität nicht verifiziert").
#
# Voraussetzungen: Docker läuft, openssl installiert, .env existiert oder Passphrase
# wird per Argument übergeben.
#
# Usage:
#   scripts/nexasign/generate-dev-cert.sh                           # Default-Volume + Passphrase aus .env
#   scripts/nexasign/generate-dev-cert.sh "meinpass"                 # Passphrase als Argument
#   scripts/nexasign/generate-dev-cert.sh "meinpass" "mein-volume"   # auch Volume-Name überschreiben
#   NEXASIGN_CERT_VOLUME=mein-volume scripts/nexasign/generate-dev-cert.sh
#
# Volume-Name: wenn Du in compose.yml oder einem Override einen anderen Namen
# als `nexasign-cert` für das Cert-Volume verwendest, musst Du ihn via Argument
# oder Env-Variable passend übergeben — sonst landet das Cert im falschen Volume.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$REPO_ROOT/docker/nexasign/.env"
VOLUME_NAME="${2:-${NEXASIGN_CERT_VOLUME:-nexasign-cert}}"

# ── Passphrase ermitteln ──────────────────────────────────────────────
PASS="${1:-}"
if [ -z "$PASS" ] && [ -f "$ENV_FILE" ]; then
  PASS=$(grep -E '^NEXT_PRIVATE_SIGNING_PASSPHRASE=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi
if [ -z "$PASS" ]; then
  echo "ℹ️  Keine Passphrase gefunden (weder Argument noch in $ENV_FILE)."
  read -r -s -p "Signatur-Passphrase eingeben: " PASS
  echo
fi
if [ -z "$PASS" ] || [ "$PASS" = "CHANGEME_CERT_PASSPHRASE" ]; then
  echo "❌ Passphrase ist leer oder noch der Placeholder."
  echo "   Bitte in $ENV_FILE den Wert für NEXT_PRIVATE_SIGNING_PASSPHRASE setzen."
  echo "   Tipp: openssl rand -base64 32"
  exit 1
fi

# ── Volume vorhanden? ─────────────────────────────────────────────────
if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "ℹ️  Docker-Volume '$VOLUME_NAME' existiert noch nicht — wird angelegt."
  docker volume create "$VOLUME_NAME" >/dev/null
fi

# ── Temp-Dir für Schlüssel und Cert ──────────────────────────────────
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── Self-signed Cert erzeugen (10 Jahre, RSA 4096) ──────────────────
openssl req -x509 -newkey rsa:4096 -sha256 -days 3650 -nodes \
  -keyout "$TMP/key.pem" -out "$TMP/cert.pem" \
  -subj "/O=NexaSign Self-Signed/CN=NexaSign Document Signing (DEV)" \
  2>/dev/null

# ── PKCS#12 mit Passphrase bauen ────────────────────────────────────
openssl pkcs12 -export \
  -inkey "$TMP/key.pem" -in "$TMP/cert.pem" \
  -out "$TMP/cert.p12" \
  -name "NexaSign Self-Signed" \
  -passout "pass:$PASS" \
  -keypbe PBE-SHA1-3DES \
  -certpbe PBE-SHA1-3DES \
  -macalg sha1

# ── Cert ins Volume kopieren + Rechte setzen ────────────────────────
docker run --rm \
  -v "$VOLUME_NAME:/v" \
  -v "$TMP:/src:ro" \
  alpine sh -c "cp /src/cert.p12 /v/cert.p12 && chmod 644 /v/cert.p12"

echo ""
echo "✅ Self-signed Cert erzeugt und ins Volume '$VOLUME_NAME' gelegt."
echo "   Im Container erreichbar unter /opt/nexasign/cert.p12"
echo ""
echo "⚠️  Dies ist ein Self-signed Zertifikat."
echo "   PDFs damit signierte Dokumente zeigen in Adobe Acrobat:"
echo "   „Gültigkeit unbekannt — Identität des Unterzeichners konnte nicht"
echo "    überprüft werden."
echo ""
echo "   Für Produktivbetrieb ein AATL-vertrauenswürdiges Cert einer CA kaufen:"
echo "   — Certum Document Signing EV  (ca. 80 €/J,   EU)"
echo "   — Sectigo Document Signing     (ca. 300 €/J,  EU/global)"
echo "   — GlobalSign Document Signing  (ca. 350 €/J,  global)"
echo "   — D-Trust AdES                 (ca. 120 €/J,  DE / Bundesdruckerei)"
echo "   Details in SIGNING.nexasign.md."
echo ""
echo "   Danach Container neu starten:"
echo "     cd docker/nexasign && docker compose restart app"
