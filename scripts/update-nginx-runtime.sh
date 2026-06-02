#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/update-nginx-runtime.sh --ref <release-tag> [--channel stable]

Environment options are the same as scripts/install-nginx-runtime.sh.
Production updates must use an explicit semver release tag, for example v0.1.0.
EOF
}

REF=""
CHANNEL="${APP_UPDATE_CHANNEL:-stable}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="${2:-}"; shift 2 ;;
    --channel) CHANNEL="${2:-}"; shift 2 ;;
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
[[ "${EUID}" -eq 0 ]] || { printf '[mnscloud-app] ERROR: this command must run as root\n' >&2; exit 1; }

cd "$REPO_ROOT"
git fetch --tags --prune

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
TARGET_COMMIT="$(resolve_git_ref "$REF" || true)"
if [[ -z "$TARGET_COMMIT" ]]; then
  recent_tags="$(git tag --sort=-creatordate | head -10 | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
  [[ -n "$recent_tags" ]] || recent_tags="none"
  die "release ref not found: ${REF}. Recent tags: ${recent_tags}"
fi

restore_previous() {
  printf '[mnscloud-app] validation failed for %s; restoring previous commit %s\n' "$REF" "${PREVIOUS_COMMIT:0:12}"
  checkout_detached_ref "$PREVIOUS_COMMIT"
  APP_UPDATE_CHANNEL="$CHANNEL" "$REPO_ROOT/scripts/install-nginx-runtime.sh"
  "$REPO_ROOT/scripts/validate-nginx-runtime.sh" || true
}

checkout_detached_ref "$TARGET_COMMIT"

if ! APP_UPDATE_CHANNEL="$CHANNEL" "$REPO_ROOT/scripts/install-nginx-runtime.sh"; then
  restore_previous
  die "update failed during install and previous commit was restored"
fi
if ! "$REPO_ROOT/scripts/validate-nginx-runtime.sh"; then
  restore_previous
  die "update failed during validation and previous commit was restored"
fi
printf '[mnscloud-app] update completed: %s (%s)\n' "$REF" "${TARGET_COMMIT:0:12}"
