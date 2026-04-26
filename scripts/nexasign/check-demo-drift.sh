#!/usr/bin/env bash
# NexaSign demo drift check.
#
# Read-only check that keeps the OSS repository and the public demo/runtime
# installation mentally separated. It does not deploy, restart containers, edit
# files, or read secret values.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${REPO_ROOT}"

MODE="warn-only"
EXPECTED_CONTAINER="${NEXASIGN_CONTAINER_NAME:-nexasign-app}"
EXPECTED_COMPOSE="${REPO_ROOT}/docker/nexasign/compose.yml"
LEGACY_OPT_DIR="${NEXASIGN_LEGACY_OPT_DIR:-/opt/nexasign}"
DEMO_VORLAGEN_DIR="${NEXASIGN_DEMO_VORLAGEN_DIR:-/var/www/nexasign/vorlagen}"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/nexasign/check-demo-drift.sh [--warn-only|--strict]

Checks:
  - git worktree is clean
  - local HEAD matches origin/main when available
  - local demo/runtime files are ignored, not tracked
  - running nexasign-app container was started from this repo's compose file
  - /opt/nexasign is reported if it looks like a stale legacy deployment folder
  - /var/www/nexasign/vorlagen is reported as external demo/template content

This script is read-only. It does not print .env values.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --warn-only)
      MODE="warn-only"
      shift
      ;;
    --strict)
      MODE="strict"
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

PASS_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  printf 'PASS %-26s %s\n' "$1" "$2"
}

warn() {
  WARN_COUNT=$((WARN_COUNT + 1))
  printf 'WARN %-26s %s\n' "$1" "$2"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  printf 'FAIL %-26s %s\n' "$1" "$2"
}

echo "NexaSign Demo Drift Check"
echo "Repo: ${REPO_ROOT}"
echo "Mode: ${MODE}"
echo

echo "== Git repository =="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  pass "git-repo" "Repository detected."
else
  fail "git-repo" "Not inside a Git repository."
fi

STATUS="$(git status --porcelain)"
if [[ -z "${STATUS}" ]]; then
  pass "worktree" "Worktree is clean."
else
  fail "worktree" "Worktree has tracked/untracked changes:"
  printf '%s\n' "${STATUS}" | sed 's/^/  /'
fi

HEAD_SHA="$(git rev-parse HEAD)"
if git rev-parse --verify origin/main >/dev/null 2>&1; then
  ORIGIN_SHA="$(git rev-parse origin/main)"
  if [[ "${HEAD_SHA}" == "${ORIGIN_SHA}" ]]; then
    pass "origin-main" "HEAD matches origin/main (${HEAD_SHA:0:7})."
  else
    fail "origin-main" "HEAD (${HEAD_SHA:0:7}) differs from origin/main (${ORIGIN_SHA:0:7}). Push or pull before treating this as clean OSS state."
  fi
else
  warn "origin-main" "origin/main not available locally; run git fetch when SSH config permits."
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"
if [[ "${REMOTE_URL}" == *"NexaStack-Software/NexaSign"* ]]; then
  pass "origin-url" "origin points to NexaStack-Software/NexaSign."
else
  warn "origin-url" "origin URL is unexpected: ${REMOTE_URL:-<missing>}"
fi

echo
echo "== Allowed local/demo files =="
if [[ -f docker/nexasign/.env ]]; then
  if git check-ignore -q docker/nexasign/.env; then
    pass "demo-env" "docker/nexasign/.env exists and is ignored."
  else
    fail "demo-env" "docker/nexasign/.env exists but is not ignored."
  fi
else
  warn "demo-env" "docker/nexasign/.env is missing on this host."
fi

UNEXPECTED_UNTRACKED="$(git ls-files --others --exclude-standard)"
if [[ -z "${UNEXPECTED_UNTRACKED}" ]]; then
  pass "untracked" "No untracked non-ignored files."
else
  fail "untracked" "Untracked non-ignored files exist:"
  printf '%s\n' "${UNEXPECTED_UNTRACKED}" | sed 's/^/  - /'
fi

if git ls-files docker/nexasign/.env DEMO.nexasign.md docker/nexasign-demo scripts/nexasign/seed-demo.sh scripts/nexasign/reset-demo.sh 2>/dev/null | grep -q .; then
  fail "tracked-demo" "Demo/operator files are tracked in Git:"
  git ls-files docker/nexasign/.env DEMO.nexasign.md docker/nexasign-demo scripts/nexasign/seed-demo.sh scripts/nexasign/reset-demo.sh | sed 's/^/  - /'
else
  pass "tracked-demo" "Known demo/operator files are not tracked."
fi

echo
echo "== Runtime container =="
if command -v docker >/dev/null 2>&1; then
  if docker inspect "${EXPECTED_CONTAINER}" >/dev/null 2>&1; then
    pass "container" "${EXPECTED_CONTAINER} exists."
    CONFIG_FILES="$(docker inspect "${EXPECTED_CONTAINER}" --format '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' 2>/dev/null || true)"
    WORKING_DIR="$(docker inspect "${EXPECTED_CONTAINER}" --format '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' 2>/dev/null || true)"
    IMAGE_NAME="$(docker inspect "${EXPECTED_CONTAINER}" --format '{{ .Config.Image }}' 2>/dev/null || true)"

    if [[ "${CONFIG_FILES}" == "${EXPECTED_COMPOSE}" ]]; then
      pass "compose-path" "Container compose path matches repo compose.yml."
    else
      fail "compose-path" "Container compose path differs. Expected ${EXPECTED_COMPOSE}, got ${CONFIG_FILES:-<missing>}."
    fi

    if [[ "${WORKING_DIR}" == "${REPO_ROOT}/docker/nexasign" ]]; then
      pass "compose-workdir" "Container compose working_dir matches repo."
    else
      warn "compose-workdir" "Container working_dir differs: ${WORKING_DIR:-<missing>}"
    fi

    if [[ "${IMAGE_NAME}" == nexasign:* ]]; then
      pass "image-name" "Container uses local nexasign image (${IMAGE_NAME})."
    else
      warn "image-name" "Container image is unexpected: ${IMAGE_NAME:-<missing>}"
    fi
  else
    warn "container" "${EXPECTED_CONTAINER} not inspectable. Docker permission missing or container not running."
  fi
else
  warn "docker" "docker command not available."
fi

echo
echo "== External demo/content locations =="
if [[ -d "${LEGACY_OPT_DIR}" ]]; then
  if [[ -d "${LEGACY_OPT_DIR}/.git" ]]; then
    warn "legacy-opt" "${LEGACY_OPT_DIR} is a Git checkout; confirm whether it should still exist."
  elif [[ -f "${LEGACY_OPT_DIR}/compose.yml" || -f "${LEGACY_OPT_DIR}/.env" ]]; then
    warn "legacy-opt" "${LEGACY_OPT_DIR} looks like a legacy/stale deployment folder, not the active source checkout."
  else
    warn "legacy-opt" "${LEGACY_OPT_DIR} exists; role unclear."
  fi
else
  pass "legacy-opt" "${LEGACY_OPT_DIR} does not exist."
fi

if [[ -d "${DEMO_VORLAGEN_DIR}" ]]; then
  COUNT="$(find "${DEMO_VORLAGEN_DIR}" -type f 2>/dev/null | wc -l)"
  pass "demo-vorlagen" "${DEMO_VORLAGEN_DIR} exists with ${COUNT} files. Treat as external demo/content layer."
else
  warn "demo-vorlagen" "${DEMO_VORLAGEN_DIR} not found on this host."
fi

echo
echo "== Summary =="
echo "PASS: ${PASS_COUNT}"
echo "WARN: ${WARN_COUNT}"
echo "FAIL: ${FAIL_COUNT}"

if [[ "${MODE}" == "strict" && "${FAIL_COUNT}" -gt 0 ]]; then
  echo "Demo drift check failed in strict mode."
  exit 1
fi

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  echo "Warn-only mode: FAIL findings are reported but not blocking."
fi

exit 0
