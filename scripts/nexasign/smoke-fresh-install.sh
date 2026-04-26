#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# © 2026 NexaStack, NexaSign contributors. Based on NexaSign (AGPL-3.0).
#
# nexasign-smoke-fresh-install — Frische Docker-Installation als Release-Gate.
#
# Bringt einen leeren Stack hoch (compose.override.yml auf Port 3070), erzeugt
# ein Self-signed Dev-Cert, prüft Healthcheck und Cert-Status, räumt auf.
# Damit ist der Pfad „Operator klont Repo, ruft compose up, erstes Sign-Setup"
# reproduzierbar als Bash-Skript validiert.
#
# Was geprüft wird (strukturell):
#   1. Image baut aus aktuellem Repo-Code
#   2. Postgres-Container kommt healthy
#   3. App-Container kommt healthy via /api/health
#   4. /api/certificate-status meldet isAvailable=false BEVOR Cert da ist
#      (entscheidend: zeigt, dass der Cert-Gate wirklich greift)
#   5. generate-dev-cert.sh schreibt valides .p12 ins Fresh-Volume
#   6. App-Restart picked Cert auf
#   7. /api/certificate-status meldet isAvailable=true mit reason=undefined
#   8. /api/health meldet checks.certificate.status=ok
#
# Nicht geprüft (delegiert an release-gate.sh):
#   - Vollständiger Recipient-Sign-Roundtrip mit PDF-Signatur-Validierung
#   - UI-Flows
#
# Aufruf:
#   scripts/nexasign/smoke-fresh-install.sh                 # voller Lauf inkl. Cleanup
#   scripts/nexasign/smoke-fresh-install.sh --keep-running  # Stack nach Test stehen lassen
#   scripts/nexasign/smoke-fresh-install.sh --no-build      # Image nicht neu bauen (Re-Run)
#   scripts/nexasign/smoke-fresh-install.sh --verbose       # Compose-Logs streamen

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_DIR="${REPO_ROOT}/docker/nexasign"
COMPOSE_FILES=(-f compose.yml -f compose.override.yml)
APP_URL="http://127.0.0.1:3070"
APP_CONTAINER="nexasign-fresh-app"
DB_CONTAINER="nexasign-fresh-db"
CERT_VOLUME="nexasign-fresh-cert"
DB_VOLUME="nexasign-fresh-db"

KEEP_RUNNING=0
NO_BUILD=0
VERBOSE=0

usage() {
  sed -n '4,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-running) KEEP_RUNNING=1; shift ;;
    --no-build)     NO_BUILD=1; shift ;;
    --verbose)      VERBOSE=1; shift ;;
    -h|--help)      usage; exit 0 ;;
    *) echo "FEHLER: unbekannte Option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# ── Logging ──────────────────────────────────────────────────────────────────
log()    { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
step()   { printf '\n=== %s ===\n' "$*"; }
fail()   { printf '\nFAIL: %s\n' "$*" >&2; exit 1; }
pass()   { printf '\nPASS: %s\n' "$*"; }

# ── Cleanup ──────────────────────────────────────────────────────────────────
cleanup() {
  local exit_code=$?
  if [[ "${KEEP_RUNNING}" -eq 1 ]]; then
    log "Stack bleibt stehen (--keep-running). Manuell abräumen mit:"
    log "  cd ${COMPOSE_DIR} && docker compose ${COMPOSE_FILES[*]} down -v"
  else
    step "Cleanup"
    cd "${COMPOSE_DIR}"
    docker compose "${COMPOSE_FILES[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
    log "Volumes ${CERT_VOLUME} und ${DB_VOLUME} entfernt."
  fi
  if [[ "${exit_code}" -ne 0 && "${VERBOSE}" -ne 1 ]]; then
    log "Lauf abgebrochen. Für Container-Logs: --verbose oder docker compose logs."
  fi
  return "${exit_code}"
}
trap cleanup EXIT

# ── Vorbedingungen ───────────────────────────────────────────────────────────
step "Vorbedingungen prüfen"
command -v docker >/dev/null || fail "docker nicht im PATH"
command -v docker compose >/dev/null 2>&1 || docker compose version >/dev/null 2>&1 \
  || fail "docker compose nicht verfügbar"
command -v jq >/dev/null   || fail "jq nicht im PATH (apt install jq)"
command -v curl >/dev/null || fail "curl nicht im PATH"

[[ -f "${COMPOSE_DIR}/compose.yml" ]] \
  || fail "compose.yml nicht gefunden: ${COMPOSE_DIR}/compose.yml"
[[ -f "${COMPOSE_DIR}/compose.override.yml" ]] \
  || fail "compose.override.yml nicht gefunden: ${COMPOSE_DIR}/compose.override.yml"
[[ -f "${COMPOSE_DIR}/.env" ]] \
  || fail ".env nicht gefunden: ${COMPOSE_DIR}/.env (cp .env.example .env und Werte setzen)"

# Passphrase muss gesetzt sein, sonst scheitert generate-dev-cert.sh später
if grep -qE '^NEXT_PRIVATE_SIGNING_PASSPHRASE=(CHANGEME_CERT_PASSPHRASE|)$' \
     "${COMPOSE_DIR}/.env"; then
  fail "NEXT_PRIVATE_SIGNING_PASSPHRASE ist Placeholder oder leer. .env editieren."
fi

log "Repo:       ${REPO_ROOT}"
log "Compose:    ${COMPOSE_DIR}"
log "App-URL:    ${APP_URL}"
log "Container:  ${APP_CONTAINER}, ${DB_CONTAINER}"
log "Volumes:    ${CERT_VOLUME}, ${DB_VOLUME}"

# ── Vorhandene Sandbox abräumen ──────────────────────────────────────────────
step "Vorhandene Sandbox abräumen (idempotent)"
cd "${COMPOSE_DIR}"
docker compose "${COMPOSE_FILES[@]}" down -v --remove-orphans >/dev/null 2>&1 || true

# ── Stack bauen und starten ──────────────────────────────────────────────────
step "Stack bauen und starten"
if [[ "${NO_BUILD}" -eq 1 ]]; then
  log "Build übersprungen (--no-build)"
  docker compose "${COMPOSE_FILES[@]}" up -d
else
  docker compose "${COMPOSE_FILES[@]}" up -d --build
fi

# ── Auf healthy warten ───────────────────────────────────────────────────────
step "Auf Container-Health warten (max 180 s)"
for i in $(seq 1 90); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "${APP_CONTAINER}" 2>/dev/null || echo "unknown")
  case "${status}" in
    healthy) log "App-Container healthy nach ${i} × 2 s"; break ;;
    starting|unhealthy|"")
      [[ "${i}" -eq 90 ]] && {
        docker compose "${COMPOSE_FILES[@]}" ps
        docker compose "${COMPOSE_FILES[@]}" logs --tail=80 app
        fail "App-Container nicht healthy nach 180 s"
      }
      sleep 2
      ;;
    *) fail "Unerwarteter Health-Status: ${status}" ;;
  esac
done

# ── Pre-Cert: Cert muss als missing gemeldet werden ──────────────────────────
step "Pre-Cert: /api/certificate-status muss isAvailable=false melden"
pre_status=$(curl -fsS "${APP_URL}/api/certificate-status")
log "Response: ${pre_status}"

is_available=$(echo "${pre_status}" | jq -r '.isAvailable')
reason=$(echo "${pre_status}" | jq -r '.reason // "none"')

if [[ "${is_available}" != "false" ]]; then
  fail "Cert wird vor Generierung als verfügbar gemeldet (isAvailable=${is_available}). Cert-Gate funktioniert nicht."
fi
if [[ "${reason}" != "missing" && "${reason}" != "empty" ]]; then
  fail "Erwarteter reason missing|empty, gefunden: ${reason}"
fi
pass "Cert-Gate greift vor Cert-Generierung (reason=${reason})"

# ── Health-Check muss warning, nicht ok melden ───────────────────────────────
step "Pre-Cert: /api/health muss certificate.status=warning melden"
pre_health=$(curl -fsS "${APP_URL}/api/health")
cert_status=$(echo "${pre_health}" | jq -r '.checks.certificate.status')

if [[ "${cert_status}" != "warning" ]]; then
  fail "Erwartet checks.certificate.status=warning, gefunden: ${cert_status}"
fi
pass "Healthcheck flaggt fehlendes Cert korrekt als warning"

# ── Dev-Cert generieren ──────────────────────────────────────────────────────
step "Dev-Cert ins Fresh-Volume generieren"
NEXASIGN_CERT_VOLUME="${CERT_VOLUME}" \
  "${REPO_ROOT}/scripts/nexasign/generate-dev-cert.sh"

# Verifizieren, dass das .p12 wirklich im Volume liegt und nicht leer ist
cert_size=$(docker run --rm -v "${CERT_VOLUME}:/v:ro" alpine \
  sh -c 'wc -c < /v/cert.p12' 2>/dev/null || echo 0)

[[ "${cert_size}" -gt 1000 ]] \
  || fail "cert.p12 zu klein oder fehlt (${cert_size} bytes)"
log "cert.p12 erfolgreich erzeugt (${cert_size} bytes)"

# ── App restarten, damit Signer-Cache neu lädt ───────────────────────────────
step "App restarten (Signer-Cache invalidieren)"
docker compose "${COMPOSE_FILES[@]}" restart app

for i in $(seq 1 60); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "${APP_CONTAINER}" 2>/dev/null || echo "unknown")
  [[ "${status}" == "healthy" ]] && { log "App-Container wieder healthy"; break; }
  [[ "${i}" -eq 60 ]] && fail "App-Container nicht healthy nach Restart"
  sleep 2
done

# ── Post-Cert: Cert muss verfügbar sein ──────────────────────────────────────
step "Post-Cert: /api/certificate-status muss isAvailable=true melden"
post_status=$(curl -fsS "${APP_URL}/api/certificate-status")
log "Response: ${post_status}"

post_available=$(echo "${post_status}" | jq -r '.isAvailable')
post_source=$(echo "${post_status}" | jq -r '.source')

[[ "${post_available}" == "true" ]] \
  || fail "Cert nach Generierung nicht verfügbar (isAvailable=${post_available})"
[[ "${post_source}" == "file" ]] \
  || fail "Erwartete source=file, gefunden: ${post_source}"
pass "Cert wird nach Generierung erkannt (source=file)"

# ── Health muss jetzt grün sein ──────────────────────────────────────────────
step "Post-Cert: /api/health muss status=ok melden"
post_health=$(curl -fsS "${APP_URL}/api/health")
overall=$(echo "${post_health}" | jq -r '.status')
post_cert_status=$(echo "${post_health}" | jq -r '.checks.certificate.status')

[[ "${post_cert_status}" == "ok" ]] \
  || fail "checks.certificate.status nach Cert nicht ok (${post_cert_status})"
log "Overall-Status: ${overall} (warning ist erlaubt für SMTP-Hinweise)"
pass "Healthcheck grün für Cert"

# ── DB-Migrations sind durch ─────────────────────────────────────────────────
step "Postgres-Migrations validieren"
migration_count=$(docker exec "${DB_CONTAINER}" psql -U nexasign -d nexasign -At \
  -c 'SELECT COUNT(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL;' 2>/dev/null \
  || echo 0)

[[ "${migration_count}" -gt 0 ]] \
  || fail "Keine Prisma-Migrations gefunden — Schema nicht initialisiert"
log "Prisma-Migrations: ${migration_count} angewendet"

# ── Verifikation des Image-Tags ──────────────────────────────────────────────
step "Image-Metadaten"
image_id=$(docker inspect --format '{{.Image}}' "${APP_CONTAINER}")
log "App-Image-ID: ${image_id:0:20}…"

# ── Erfolg ───────────────────────────────────────────────────────────────────
step "Smoke-Test bestanden"
log "Frische Installation läuft, Cert-Gate greift, Healthcheck korrekt."
log ""
log "Nächster Schritt: Playwright-Release-Suite gegen diesen Stack laufen lassen:"
log "  E2E_BASE_URL=${APP_URL} npm run test:e2e -w @nexasign/app-tests -- e2e/release/"
log ""
log "Oder das volle Release-Gate (typecheck + build + e2e + drift):"
log "  scripts/nexasign/release-gate.sh"

exit 0
