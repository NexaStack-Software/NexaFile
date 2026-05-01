#!/usr/bin/env bash
# NexaFile V1 release gate.
#
# Runs the checks that must stay green before tagging a release candidate:
# generated Prisma client, focused TypeScript checks, lint, production build,
# and the release-critical E2E path for signing, completion, certificate pages,
# and API distribution validation.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

RUN_LINT=1
RUN_BUILD=1
RUN_E2E=1
RUN_DRIFT=1
E2E_MODE="release"
DEV_COMPOSE_FILE="${REPO_ROOT}/docker/development/compose.yml"

usage() {
  cat <<'EOF'
Usage:
  scripts/nexasign/release-gate.sh [options]

Options:
  --full-e2e        Run the whole Playwright E2E suite instead of the release subset.
  --skip-lint       Skip npm run lint.
  --skip-build      Skip npm run build.
  --skip-e2e        Skip Playwright E2E tests.
  --skip-drift      Skip scripts/nexasign/check-demo-drift.sh --strict.
  --typecheck-only  Run Prisma generation and TypeScript checks only.
  -h, --help        Show this help.

Environment:
  E2E_TEST_PATH     Override the release Playwright test path list.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --full-e2e)
      E2E_MODE="full"
      shift
      ;;
    --skip-lint)
      RUN_LINT=0
      shift
      ;;
    --skip-build)
      RUN_BUILD=0
      shift
      ;;
    --skip-e2e)
      RUN_E2E=0
      shift
      ;;
    --skip-drift)
      RUN_DRIFT=0
      shift
      ;;
    --typecheck-only)
      RUN_LINT=0
      RUN_BUILD=0
      RUN_E2E=0
      RUN_DRIFT=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "FEHLER: unbekannte Option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

run() {
  printf '\n== %s ==\n' "$*"
  "$@"
}

run_v1_checks() {
  printf '\n== V1 NexaFile checks ==\n'

  bash -n tools/nexasign-gobd-export.sh
  bash -n tools/nexasign-retention-check.sh

  local legacy_hits
  legacy_hits=$(
    grep -RIn "NexaSign\\|NexaFILE\\|alle 15 Minuten" \
      apps/remix/app \
      packages/email \
      apps/docs/src \
      README.md \
      docker/README.md \
      ARCHITECTURE.md \
      CONTRIBUTING.md \
      --exclude-dir=node_modules \
      --exclude-dir=build \
      --exclude-dir=.turbo \
      2>/dev/null \
      | grep -v "contributors" \
      | grep -v "github.com" \
      | grep -v "X-NexaSign-Secret" \
      || true
  )

  if [[ -n "${legacy_hits}" ]]; then
    echo "FEHLER: User-facing Legacy-Branding oder falsche Sync-Kopie gefunden:" >&2
    echo "${legacy_hits}" >&2
    exit 1
  fi

  if [[ ! -f packages/prisma/migrations/20260430130000_backfill_discovery_retention_start/migration.sql ]]; then
    echo "FEHLER: Discovery-Retention-Backfill-Migration fehlt." >&2
    exit 1
  fi
}

prepare_e2e_environment() {
  printf '\n== prepare E2E environment ==\n'

  export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-secret}"
  export NEXT_PRIVATE_ENCRYPTION_KEY="${NEXT_PRIVATE_ENCRYPTION_KEY:-CAFEBABE}"
  export NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY="${NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY:-DEADBEEF}"
  export NEXT_PUBLIC_WEBAPP_URL="${NEXT_PUBLIC_WEBAPP_URL:-http://localhost:3000}"
  export NEXT_PRIVATE_INTERNAL_WEBAPP_URL="${NEXT_PRIVATE_INTERNAL_WEBAPP_URL:-http://localhost:3000}"
  export NEXT_PRIVATE_DATABASE_URL="${NEXT_PRIVATE_DATABASE_URL:-postgres://nexasign:password@127.0.0.1:54320/nexasign}"
  export NEXT_PRIVATE_DIRECT_DATABASE_URL="${NEXT_PRIVATE_DIRECT_DATABASE_URL:-${NEXT_PRIVATE_DATABASE_URL}}"
  export NEXT_PUBLIC_UPLOAD_TRANSPORT="${NEXT_PUBLIC_UPLOAD_TRANSPORT:-database}"
  export NEXT_PRIVATE_JOBS_PROVIDER="${NEXT_PRIVATE_JOBS_PROVIDER:-local}"
  export NEXT_PRIVATE_SMTP_TRANSPORT="${NEXT_PRIVATE_SMTP_TRANSPORT:-smtp-auth}"
  export NEXT_PRIVATE_SMTP_HOST="${NEXT_PRIVATE_SMTP_HOST:-127.0.0.1}"
  export NEXT_PRIVATE_SMTP_PORT="${NEXT_PRIVATE_SMTP_PORT:-2500}"
  export NEXT_PRIVATE_SMTP_USERNAME="${NEXT_PRIVATE_SMTP_USERNAME:-nexasign}"
  export NEXT_PRIVATE_SMTP_PASSWORD="${NEXT_PRIVATE_SMTP_PASSWORD:-password}"
  export NEXT_PRIVATE_SMTP_FROM_NAME="${NEXT_PRIVATE_SMTP_FROM_NAME:-NexaFile}"
  export NEXT_PRIVATE_SMTP_FROM_ADDRESS="${NEXT_PRIVATE_SMTP_FROM_ADDRESS:-noreply@nexastack.co}"
  export NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH="${NEXT_PRIVATE_SIGNING_LOCAL_FILE_PATH:-${REPO_ROOT}/apps/remix/example/cert.p12}"
  export NEXT_PRIVATE_SIGNING_PASSPHRASE="${NEXT_PRIVATE_SIGNING_PASSPHRASE:-}"
  export CI="${CI:-1}"

  if command -v docker >/dev/null 2>&1; then
    docker compose -f "${DEV_COMPOSE_FILE}" up -d database inbucket redis minio

    for _ in $(seq 1 60); do
      if docker compose -f "${DEV_COMPOSE_FILE}" exec -T database pg_isready -U nexasign -d nexasign >/dev/null 2>&1; then
        break
      fi
      sleep 2
    done
  else
    echo "WARN docker not available; assuming external services are already running."
  fi

  run npm run prisma:migrate-deploy
}

DEFAULT_E2E_TEST_PATH="e2e/release/signing-preflight.spec.ts e2e/envelopes/envelope-v2-field-insertion.spec.ts e2e/features/include-document-certificate.spec.ts e2e/envelopes/cert-page-dimensions.spec.ts e2e/api/v2/distribute-validation.spec.ts"

export NEXT_PRIVATE_SIGNING_TRANSPORT="${NEXT_PRIVATE_SIGNING_TRANSPORT:-local}"

echo "NexaFile V1 Release Gate"
echo "Repo: ${REPO_ROOT}"
echo "E2E mode: ${E2E_MODE}"
echo

run npm run prisma:generate
run npx tsc -p packages/lib/tsconfig.json --noEmit
run npx tsc -p apps/remix/tsconfig.json --noEmit
run npx tsc -p packages/app-tests/tsconfig.json --noEmit
run_v1_checks

if [[ "${RUN_LINT}" -eq 1 ]]; then
  run npx turbo run lint --concurrency=1
fi

if [[ "${RUN_BUILD}" -eq 1 ]]; then
  run npm run build
fi

if [[ "${RUN_E2E}" -eq 1 ]]; then
  prepare_e2e_environment

  if [[ "${E2E_MODE}" == "full" ]]; then
    run npm run test:e2e -w @nexasign/app-tests
  else
    export E2E_TEST_PATH="${E2E_TEST_PATH:-${DEFAULT_E2E_TEST_PATH}}"
    echo
    echo "Release E2E subset:"
    printf '%s\n' "${E2E_TEST_PATH}" | tr ' ' '\n' | sed 's/^/  - /'
    run npm run test:e2e -w @nexasign/app-tests
  fi
fi

if [[ "${RUN_DRIFT}" -eq 1 ]]; then
  run scripts/nexasign/check-demo-drift.sh --strict
fi

echo
echo "PASS NexaFile V1 release gate completed."
