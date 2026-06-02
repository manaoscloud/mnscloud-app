#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

find_runtime_kit() {
  local candidate
  for candidate in \
    "${MNSCLOUD_RUNTIME_KIT_DIR:-}" \
    "${REPO_ROOT}/../mnscloud-runtime-kit" \
    "/opt/mnscloud/runtime-kit" \
    "/opt/mnscloud/repos/mnscloud-runtime-kit"; do
    [[ -n "$candidate" && -r "${candidate}/lib/release.sh" ]] || continue
    printf '%s\n' "$candidate"
    return 0
  done
  return 1
}

cd "$REPO_ROOT"
RUNTIME_KIT_DIR="$(find_runtime_kit)" || {
  printf '[mnscloud-app] ERROR: mnscloud-runtime-kit lib/release.sh not found\n' >&2
  exit 1
}

# shellcheck source=/opt/mnscloud/runtime-kit/lib/release.sh
source "${RUNTIME_KIT_DIR}/lib/release.sh"

mrtk_release_prepare \
  --product mnscloud-app \
  --repository manaoscloud/mnscloud-app \
  --minimum-version 0.1.0 \
  --sync-package-json \
  --validate 'bash -n scripts/*.sh' \
  --validate 'npm run build' \
  "$@"
