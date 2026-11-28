#!/usr/bin/env bash
# Bounded retention of the App web root.
#
# The web root keeps the files of previous releases on purpose: browser sessions opened before an
# update still request their lazy chunks. Every deploy records the file list of its release in the
# state directory; a file of the web root is removed only when no kept release lists it. Kept
# releases = the newest --keep lists plus every list recorded within --grace-hours. Retention never
# depends on file mtimes (artifacts carry normalized mtimes and the installer touches deployed files).
#
# Usage:
#   prune-web-root.sh --web-root DIR --state-dir DIR [--record RELEASE --files-from LIST]
#                     [--keep N] [--grace-hours H] [--dry-run]
#
# Prints one JSON summary line on stdout.
set -Eeuo pipefail

WEB_ROOT=""
STATE_DIR=""
RECORD_ID=""
FILES_FROM=""
KEEP="${APP_KEEP_RELEASES:-5}"
GRACE_HOURS="${APP_ASSET_GRACE_HOURS:-48}"
DRY_RUN=0
NOW="${PRUNE_WEB_ROOT_NOW:-$(date +%s)}"
# Files the installer writes into the web root itself (never part of a release list).
PROTECTED=(env.js build.json)

die() { printf '[prune-web-root] ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '[prune-web-root] %s\n' "$*" >&2; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --web-root) WEB_ROOT="${2:-}"; shift 2 ;;
    --state-dir) STATE_DIR="${2:-}"; shift 2 ;;
    --record) RECORD_ID="${2:-}"; shift 2 ;;
    --files-from) FILES_FROM="${2:-}"; shift 2 ;;
    --keep) KEEP="${2:-}"; shift 2 ;;
    --grace-hours) GRACE_HOURS="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "--keep must be a positive integer"
[[ "$GRACE_HOURS" =~ ^[0-9]+$ ]] || die "--grace-hours must be a non-negative integer"
[[ "$NOW" =~ ^[0-9]+$ ]] || die "invalid clock"
[[ "$WEB_ROOT" == /* && "$STATE_DIR" == /* ]] || die "--web-root and --state-dir must be absolute"
[[ -d "$WEB_ROOT" && ! -L "$WEB_ROOT" ]] || die "web root is not a directory: ${WEB_ROOT}"
WEB_ROOT="$(realpath -e "$WEB_ROOT")"
[[ "$WEB_ROOT" != "/" ]] || die "refusing to prune /"
if [[ -n "$RECORD_ID" || -n "$FILES_FROM" ]]; then
  [[ "$RECORD_ID" =~ ^[0-9A-Za-z][0-9A-Za-z.+_-]*$ ]] || die "invalid release id: ${RECORD_ID:-empty}"
  [[ -f "$FILES_FROM" ]] || die "release file list not found: ${FILES_FROM:-empty}"
  grep -qx 'index.html' "$FILES_FROM" || die "release file list has no index.html"
fi

install -d -m 0755 "$STATE_DIR"
STATE_DIR="$(realpath -e "$STATE_DIR")"
case "$STATE_DIR/" in "$WEB_ROOT"/*) die "state directory must be outside the web root" ;; esac
grace_seconds=$((GRACE_HOURS * 3600))

# The first run only starts the clock: files that no list covers yet may still be needed by open
# sessions of releases deployed before retention existed.
[[ -s "${STATE_DIR}/since" ]] || { [[ "$DRY_RUN" == "1" ]] || printf '%s\n' "$NOW" > "${STATE_DIR}/since"; }
since="$(tr -dc '0-9' < "${STATE_DIR}/since" 2>/dev/null || true)"
[[ -n "$since" ]] || since="$NOW"

if [[ -n "$RECORD_ID" && "$DRY_RUN" != "1" ]]; then
  # A redeploy of the same release moves it to the front instead of keeping two lists.
  find "$STATE_DIR" -maxdepth 1 -type f -name "*-${RECORD_ID}.files" -delete
  LC_ALL=C sort -u "$FILES_FROM" > "${STATE_DIR}/$(printf '%012d' "$NOW")-${RECORD_ID}.files"
fi

mapfile -t lists < <(find "$STATE_DIR" -maxdepth 1 -type f -name '[0-9]*-*.files' -printf '%f\n' | LC_ALL=C sort -r)
kept=()
dropped=()
for index in "${!lists[@]}"; do
  name="${lists[$index]}"
  recorded=$((10#${name%%-*}))
  if (( index < KEEP || NOW - recorded < grace_seconds )); then kept+=("$name"); else dropped+=("$name"); fi
done
[[ "${#kept[@]}" -gt 0 ]] || die "no release list recorded; nothing is pruned"

union="$(mktemp)"
present="$(mktemp)"
trap 'rm -f "$union" "$present"' EXIT
{
  for name in "${kept[@]}"; do cat "${STATE_DIR}/${name}"; done
  printf '%s\n' "${PROTECTED[@]}"
} | LC_ALL=C sort -u > "$union"
# -P: never follow symlinks; hidden paths (for example .well-known) are not release files.
(cd "$WEB_ROOT" && find -P . -type f ! -path '*/.*' -printf '%P\n') | LC_ALL=C sort -u > "$present"

removed=0
freed=0
transition=0
if (( NOW - since < grace_seconds )); then
  transition=1
else
  while IFS= read -r relative; do
    [[ -n "$relative" ]] || continue
    path="${WEB_ROOT}/${relative}"
    [[ -f "$path" && ! -L "$path" ]] || continue
    size="$(stat -c %s -- "$path" 2>/dev/null || echo 0)"
    if [[ "$DRY_RUN" != "1" ]]; then rm -f -- "$path"; fi
    removed=$((removed + 1))
    freed=$((freed + size))
  done < <(LC_ALL=C comm -23 "$present" "$union")
  [[ "$DRY_RUN" == "1" ]] || find -P "$WEB_ROOT" -mindepth 1 -type d -empty ! -path '*/.*' -delete
fi

if [[ "$DRY_RUN" != "1" ]]; then
  for name in "${dropped[@]}"; do rm -f -- "${STATE_DIR}/${name}"; done
fi

printf '{"webRoot":"%s","keptReleases":%d,"droppedLists":%d,"removedFiles":%d,"freedBytes":%d,"transition":%s,"dryRun":%s}\n' \
  "$WEB_ROOT" "${#kept[@]}" "${#dropped[@]}" "$removed" "$freed" \
  "$([[ "$transition" == 1 ]] && echo true || echo false)" "$([[ "$DRY_RUN" == 1 ]] && echo true || echo false)"
