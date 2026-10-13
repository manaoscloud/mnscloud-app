#!/usr/bin/env bash
# Production build guard for shared developer hosts (`npm run build`).
#
# One app build uses ~11.5 GB of RAM. When several AI agents build from their own worktrees at the
# same time, the host runs out of memory and freezes. This guard:
#   1. Queues builds machine-wide: one build at a time through a lock shared by every worktree.
#   2. Caps each build in its own cgroup (systemd scope) without swap, so a runaway build fails
#      fast with a clear message instead of freezing the host.
#   3. Runs the build with a lower CPU priority so editors and agents stay responsive.
#
# CI runners and container builds (`CI` set) run the build directly.
#
# Environment (all optional):
#   MNSCLOUD_BUILD_GUARD=0            run the build directly, without queue or cap
#   MNSCLOUD_BUILD_LOCK=<path>        lock file (default /var/lock/mnscloud-app-build.lock)
#   MNSCLOUD_BUILD_LOCK_WAIT=<sec>    maximum wait for the build slot (default 3600)
#   MNSCLOUD_BUILD_MEMORY_MAX=<size>  per-build memory cap, systemd syntax (default 14G; 0 = none)
#   MNSCLOUD_BUILD_NICE=<n>           CPU niceness (default 10)
#   MNSCLOUD_BUILD_COMMAND=<cmd>      replaces the Angular build (used by the guard's own tests)
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${MNSCLOUD_BUILD_COMMAND:-}" ]]; then
  build=(bash -c "$MNSCLOUD_BUILD_COMMAND")
else
  build=(node --max-old-space-size=6144 node_modules/@angular/cli/bin/ng.js build "$@")
fi

if [[ -n "${CI:-}" || "${MNSCLOUD_BUILD_GUARD:-1}" == "0" ]]; then
  exec "${build[@]}"
fi

log() { echo "[build-guard] $*" >&2; }

lock="${MNSCLOUD_BUILD_LOCK:-/var/lock/mnscloud-app-build.lock}"
if ! { : >>"$lock"; } 2>/dev/null; then
  lock="${TMPDIR:-/tmp}/mnscloud-app-build.lock"
fi
owner="${lock}.owner"
wait_seconds="${MNSCLOUD_BUILD_LOCK_WAIT:-3600}"
memory_max="${MNSCLOUD_BUILD_MEMORY_MAX:-14G}"
niceness="${MNSCLOUD_BUILD_NICE:-10}"

# 1. Machine-wide queue.
if command -v flock >/dev/null 2>&1; then
  exec 9>>"$lock"
  if ! flock -n 9; then
    log "another mnscloud-app build is running ($(cat "$owner" 2>/dev/null || echo 'owner unknown'))."
    log "waiting up to ${wait_seconds}s for the build slot..."
    if ! flock -w "$wait_seconds" 9; then
      log "timed out waiting for the build slot. Run the build again later."
      exit 75
    fi
  fi
  echo "pid $$ in $(pwd) since $(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$owner" 2>/dev/null || true
  trap 'rm -f "$owner"' EXIT
else
  log "flock not found; building without the machine-wide queue."
fi

# 2. Per-build memory cap (systemd scope), only where it can be created.
runner=()
if [[ "$memory_max" != "0" ]] && command -v systemd-run >/dev/null 2>&1 \
  && [[ -d /run/systemd/system ]]; then
  scope=(systemd-run --scope --quiet --collect -p "MemoryMax=${memory_max}" -p MemorySwapMax=0)
  [[ "$(id -u)" == "0" ]] || scope+=(--user)
  if "${scope[@]}" true >/dev/null 2>&1; then
    runner=("${scope[@]}" --)
  else
    log "cannot create a memory-limited scope; building without the ${memory_max} cap."
  fi
fi

# 3. Lower CPU priority.
if [[ "$niceness" != "0" ]] && command -v nice >/dev/null 2>&1; then
  runner+=(nice -n "$niceness")
fi

status=0
"${runner[@]}" "${build[@]}" || status=$?
if [[ "$status" == "137" && ${#runner[@]} -gt 0 ]]; then
  log "the build was stopped after exceeding MNSCLOUD_BUILD_MEMORY_MAX=${memory_max}."
fi
exit "$status"
