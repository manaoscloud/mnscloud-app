#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/rollback-nginx-runtime.sh --ref <known-good-git-ref>

Environment options are the same as scripts/install-nginx-runtime.sh.
EOF
}

REF=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref) REF="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) printf '[mnscloud-app] ERROR: unknown argument: %s\n' "$1" >&2; usage; exit 1 ;;
  esac
done

[[ -n "$REF" ]] || { usage; exit 1; }
[[ "${EUID}" -eq 0 ]] || { printf '[mnscloud-app] ERROR: this command must run as root\n' >&2; exit 1; }

cd "$REPO_ROOT"
git fetch --tags --prune
git checkout --detach "$REF"

"$REPO_ROOT/scripts/install-nginx-runtime.sh"
"$REPO_ROOT/scripts/validate-nginx-runtime.sh"
printf '[mnscloud-app] rollback completed: %s\n' "$REF"
