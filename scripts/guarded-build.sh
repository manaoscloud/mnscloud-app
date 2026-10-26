#!/usr/bin/env bash
# Production build guard for shared developer hosts (`npm run build`).
#
# One cold app build needs ~19-20 GB at its peak (14 GB RAM at its cap plus ~6 GB of swap, measured
# 2026-10-26 with the 10 GB heap; ~12-13.5 GB with the 6 GB heap on 2026-10-17). When several AI
# agents built from their own worktrees at the same time without limits, the host ran out of memory
# and froze. This guard:
#   1. Queues builds machine-wide: at most MNSCLOUD_BUILD_SLOTS builds at a time (default 2), through
#      slot locks shared by every worktree.
#   2. Caps each build in its own cgroup (systemd scope), and all running builds together in one
#      slice (mnscloud-app-build.slice) whose RAM is capped and backed by a little swap: the rest
#      of the host keeps its RAM, and a build that exceeds the caps (since the 10 GB heap, two
#      builds whose peaks overlap) fails with a clear message instead of freezing the host. When
#      the combined cap cannot be applied, only one slot is used, without swap.
#   3. Runs the build with a lower CPU priority so editors and agents stay responsive.
#
# CI runners and container builds (`CI` set) run the build directly.
#
# Environment (all optional):
#   MNSCLOUD_BUILD_GUARD=0                  run the build directly, without queue or cap
#   MNSCLOUD_BUILD_LOCK=<path>              slot 1 lock file (default /var/lock/mnscloud-app-build.lock);
#                                           slot N uses <path>.N
#   MNSCLOUD_BUILD_SLOTS=<n>                concurrent builds per host (default 2)
#   MNSCLOUD_BUILD_LOCK_WAIT=<sec>          maximum wait for a build slot (default 3600)
#   MNSCLOUD_BUILD_MEMORY_MAX=<size>        per-build memory cap, systemd syntax (default 14G; 0 = none)
#   MNSCLOUD_BUILD_TOTAL_MEMORY_MAX=<size>  RAM cap for all running builds together (default 22G; 0 = none)
#   MNSCLOUD_BUILD_TOTAL_SWAP_MAX=<size>    swap the running builds may use together (default 6G)
#   MNSCLOUD_BUILD_NICE=<n>                 CPU niceness (default 10)
#   MNSCLOUD_BUILD_COMMAND=<cmd>            replaces the Angular build (used by the guard's own tests)
#   MNSCLOUD_DISK_CHECK=<path>              workspace free-space check run before queueing (default
#                                           $MNSCLOUD_WORKSPACE_ROOT/scripts/ops/disk-check.sh; empty = none)
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -n "${MNSCLOUD_BUILD_COMMAND:-}" ]]; then
  build=(bash -c "$MNSCLOUD_BUILD_COMMAND")
else
  # ~240 CRUD pages each compile the shared CRUD template; 6 GB and then 8 GB of heap stopped being
  # enough for the Angular compiler worker (JS heap out of memory in CI, 2026-10-24). 10 GB stays
  # under the per-build cgroup cap (14G) and the 16 GB of the GitHub runner.
  build=(node --max-old-space-size=10240 node_modules/@angular/cli/bin/ng.js build "$@")
fi

if [[ -n "${CI:-}" || "${MNSCLOUD_BUILD_GUARD:-1}" == "0" ]]; then
  exec "${build[@]}"
fi

log() { echo "[build-guard] $*" >&2; }

# A full workspace disk stalls every agent; do not start a build there (workspace
# docs/workspace-disk-hygiene.md). The check exists only on the workspace host.
disk_check="${MNSCLOUD_DISK_CHECK-${MNSCLOUD_WORKSPACE_ROOT:-/opt/mnscloud}/scripts/ops/disk-check.sh}"
if [[ -n "$disk_check" && -x "$disk_check" ]] && ! "$disk_check" --quiet; then
  log 'not started: the workspace disk is full (see the disk-check message above)'
  exit 74
fi

lock="${MNSCLOUD_BUILD_LOCK:-/var/lock/mnscloud-app-build.lock}"
if ! { : >>"$lock"; } 2>/dev/null; then
  lock="${TMPDIR:-/tmp}/mnscloud-app-build.lock"
fi
slots="${MNSCLOUD_BUILD_SLOTS:-2}"
[[ "$slots" =~ ^[1-9][0-9]*$ ]] || slots=1
wait_seconds="${MNSCLOUD_BUILD_LOCK_WAIT:-3600}"
memory_max="${MNSCLOUD_BUILD_MEMORY_MAX:-14G}"
total_memory_max="${MNSCLOUD_BUILD_TOTAL_MEMORY_MAX:-22G}"
total_swap_max="${MNSCLOUD_BUILD_TOTAL_SWAP_MAX:-6G}"
niceness="${MNSCLOUD_BUILD_NICE:-10}"
slice="mnscloud-app-build.slice"

# 1. Memory caps: one scope per build, inside one slice capped for all builds together.
runner=()
total_capped=0
if [[ "$memory_max" != "0" ]] && command -v systemd-run >/dev/null 2>&1 \
  && [[ -d /run/systemd/system ]]; then
  manager=()
  [[ "$(id -u)" == "0" ]] || manager=(--user)
  scope=(systemd-run "${manager[@]}" --scope --quiet --collect -p "MemoryMax=${memory_max}")
  if [[ "$total_memory_max" != "0" ]] \
    && systemctl "${manager[@]}" set-property --runtime "$slice" \
      "MemoryMax=${total_memory_max}" "MemorySwapMax=${total_swap_max}" >/dev/null 2>&1 \
    && "${scope[@]}" "--slice=${slice}" true >/dev/null 2>&1; then
    runner=("${scope[@]}" "--slice=${slice}" --)
    total_capped=1
  elif "${scope[@]}" -p MemorySwapMax=0 true >/dev/null 2>&1; then
    runner=("${scope[@]}" -p MemorySwapMax=0 --)
  else
    log "cannot create a memory-limited scope; building without the ${memory_max} cap."
  fi
fi
if ((slots > 1)) && [[ "$total_memory_max" != "0" && "$total_capped" == "0" ]]; then
  log "cannot apply the combined ${total_memory_max} cap; using one build slot."
  slots=1
fi

# 2. Machine-wide queue: take the first free slot.
slot_file() { if (($1 == 1)); then echo "$lock"; else echo "${lock}.$1"; fi; }
owners() {
  local i out=()
  for ((i = 1; i <= slots; i++)); do
    out+=("$(cat "$(slot_file "$i").owner" 2>/dev/null || echo 'owner unknown')")
  done
  local IFS=';'
  echo "${out[*]}"
}
try_slots() {
  local i file
  for ((i = 1; i <= slots; i++)); do
    file="$(slot_file "$i")"
    exec {slot_fd}>>"$file" || continue
    if flock -n "$slot_fd"; then
      owner="${file}.owner"
      return 0
    fi
    exec {slot_fd}>&-
  done
  return 1
}

owner=""
if command -v flock >/dev/null 2>&1; then
  if ! try_slots; then
    log "another mnscloud-app build is running in each of the ${slots} slot(s) ($(owners))."
    log "waiting up to ${wait_seconds}s for a build slot..."
    deadline=$((SECONDS + wait_seconds))
    until try_slots; do
      if ((SECONDS >= deadline)); then
        log "timed out waiting for the build slot. Run the build again later."
        exit 75
      fi
      sleep 1
    done
  fi
  echo "pid $$ in $(pwd) since $(date -u +%Y-%m-%dT%H:%M:%SZ)" >"$owner" 2>/dev/null || true
  trap 'rm -f "$owner"' EXIT
else
  log "flock not found; building without the machine-wide queue."
fi

# 3. Lower CPU priority.
if [[ "$niceness" != "0" ]] && command -v nice >/dev/null 2>&1; then
  runner+=(nice -n "$niceness")
fi

status=0
"${runner[@]}" "${build[@]}" || status=$?
if [[ "$status" == "137" && ${#runner[@]} -gt 0 ]]; then
  log "the build was stopped after exceeding MNSCLOUD_BUILD_MEMORY_MAX=${memory_max}" \
    "or the combined MNSCLOUD_BUILD_TOTAL_MEMORY_MAX=${total_memory_max} + MNSCLOUD_BUILD_TOTAL_SWAP_MAX=${total_swap_max}."
fi
exit "$status"
