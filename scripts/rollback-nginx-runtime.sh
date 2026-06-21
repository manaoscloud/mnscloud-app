#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/rollback-nginx-runtime.sh --ref <known-good-release-tag> --artifact-url <url> --artifact-sha256 <sha256>

Environment options are the same as scripts/install-nginx-runtime.sh.
EOF
}

REF=""
APP_ARTIFACT_URL="${APP_ARTIFACT_URL:-}"
APP_ARTIFACT_SHA256="${APP_ARTIFACT_SHA256:-}"
APP_ARTIFACT_NAME="${APP_ARTIFACT_NAME:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="${2:-}"; shift 2 ;;
    --artifact-url) APP_ARTIFACT_URL="${2:-}"; shift 2 ;;
    --artifact-sha256) APP_ARTIFACT_SHA256="${2:-}"; shift 2 ;;
    --artifact-name) APP_ARTIFACT_NAME="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) printf '[mnscloud-app] ERROR: unknown argument: %s\n' "$1" >&2; usage; exit 1 ;;
  esac
done

die() { printf '[mnscloud-app] ERROR: %s\n' "$*" >&2; exit 1; }
validate_release_ref() {
  local ref="$1"
  [[ "$ref" =~ ^v[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?$ ]] ||
    die "invalid release ref: ${ref:-empty}. Use an explicit semver tag like v0.1.0"
}
resolve_git_ref() {
  local ref="$1"
  local candidate
  for candidate in "$ref" "origin/$ref" "refs/tags/$ref" "refs/heads/$ref" "refs/remotes/origin/$ref"; do
    git rev-parse --verify --quiet "${candidate}^{commit}" && return 0
  done
  return 1
}
checkout_detached_ref() {
  local target_commit="$1"
  if git switch -h >/dev/null 2>&1; then
    git switch --detach "$target_commit"
  else
    git checkout "$target_commit"
  fi
}

[[ -n "$REF" ]] || { usage; exit 1; }
validate_release_ref "$REF"
[[ -n "$APP_ARTIFACT_URL" ]] || die "--artifact-url is required"
[[ -n "$APP_ARTIFACT_SHA256" ]] || die "--artifact-sha256 is required"
[[ "${EUID}" -eq 0 ]] || { printf '[mnscloud-app] ERROR: this command must run as root\n' >&2; exit 1; }

cd "$REPO_ROOT"
git fetch --tags --prune
TARGET_COMMIT="$(resolve_git_ref "$REF" || true)"
if [[ -z "$TARGET_COMMIT" ]]; then
  recent_tags="$(git tag --sort=-creatordate | head -10 | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
  [[ -n "$recent_tags" ]] || recent_tags="none"
  die "release ref not found: ${REF}. Recent tags: ${recent_tags}"
fi
checkout_detached_ref "$TARGET_COMMIT"

APP_ARTIFACT_URL="$APP_ARTIFACT_URL" \
  APP_ARTIFACT_SHA256="$APP_ARTIFACT_SHA256" \
  APP_ARTIFACT_NAME="$APP_ARTIFACT_NAME" \
  "$REPO_ROOT/scripts/install-nginx-runtime.sh"
"$REPO_ROOT/scripts/validate-nginx-runtime.sh"
printf '[mnscloud-app] rollback completed: %s\n' "$REF"
