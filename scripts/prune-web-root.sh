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
#                     [--live-release RELEASE] [--keep N] [--grace-hours H] [--dry-run]
#
# Lists are ordered by a deploy sequence number, never by the clock. --live-release names the release
# that served before this deploy (it stays kept; when it has no list, nothing is removed this run, so
# a rollback to a release recorded before retention existed never loses its files).
#
# Prints one JSON summary line on stdout.
set -Eeuo pipefail

WEB_ROOT=""
STATE_DIR=""
RECORD_ID=""
FILES_FROM=""
LIVE_ID=""
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
    --live-release) LIVE_ID="${2:-}"; shift 2 ;;
    --keep) KEEP="${2:-}"; shift 2 ;;
    --grace-hours) GRACE_HOURS="${2:-}"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ "$KEEP" =~ ^[0-9]+$ && "$KEEP" -ge 2 ]] || die "--keep must be an integer >= 2"
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
ID_PATTERN='^[0-9A-Za-z][0-9A-Za-z.+_-]*$'
[[ -z "$LIVE_ID" || "$LIVE_ID" =~ $ID_PATTERN ]] || die "invalid live release id: ${LIVE_ID}"

install -d -m 0755 "$STATE_DIR"
STATE_DIR="$(realpath -e "$STATE_DIR")"
case "$STATE_DIR/" in "$WEB_ROOT"/*) die "state directory must be outside the web root" ;; esac
grace_seconds=$((GRACE_HOURS * 3600))

# The first run only starts the clock: files that no list covers yet may still be needed by open
# sessions of releases deployed before retention existed.
[[ -s "${STATE_DIR}/since" ]] || { [[ "$DRY_RUN" == "1" ]] || printf '%s\n' "$NOW" > "${STATE_DIR}/since"; }
since="$(tr -dc '0-9' < "${STATE_DIR}/since" 2>/dev/null || true)"
[[ -n "$since" ]] || since="$NOW"

# List names: <sequence>-<deploy epoch>-<release>.files (12 digits each). Other names are ignored.
LIST_PATTERN='^[0-9]{12}-[0-9]{12}-[0-9A-Za-z][0-9A-Za-z.+_-]*[.]files$'
release_of() { local rest="${1#*-}"; rest="${rest#*-}"; printf '%s' "${rest%.files}"; }
mapfile -t lists < <(find "$STATE_DIR" -maxdepth 1 -type f -name '*.files' -printf '%f\n' |
  grep -E "$LIST_PATTERN" | LC_ALL=C sort -r || true)

if [[ -n "$RECORD_ID" && "$DRY_RUN" != "1" ]]; then
  sequence=1
  [[ "${#lists[@]}" -eq 0 ]] || sequence=$((10#${lists[0]%%-*} + 1))
  # A redeploy of the same release moves it to the front instead of keeping two lists.
  for name in "${lists[@]}"; do
    [[ "$(release_of "$name")" != "$RECORD_ID" ]] || rm -f -- "${STATE_DIR}/${name}"
  done
  LC_ALL=C sort -u "$FILES_FROM" > "${STATE_DIR}/$(printf '%012d-%012d' "$sequence" "$NOW")-${RECORD_ID}.files"
  mapfile -t lists < <(find "$STATE_DIR" -maxdepth 1 -type f -name '*.files' -printf '%f\n' |
    grep -E "$LIST_PATTERN" | LC_ALL=C sort -r || true)
fi

kept=()
dropped=()
live_recorded=0
for index in "${!lists[@]}"; do
  name="${lists[$index]}"
  recorded="${name#*-}"
  recorded=$((10#${recorded%%-*}))
  release="$(release_of "$name")"
  [[ "$release" != "$LIVE_ID" ]] || live_recorded=1
  # A list stamped in the future (clock corrected backwards) counts as inside the grace window.
  if (( index < KEEP || NOW - recorded < grace_seconds )) || [[ -n "$LIVE_ID" && "$release" == "$LIVE_ID" ]]; then
    kept+=("$name")
  else
    dropped+=("$name")
  fi
done
[[ "${#kept[@]}" -gt 0 ]] || die "no release list recorded; nothing is pruned"

union="$(mktemp)"
present="$(mktemp)"
doomed="$(mktemp)"
trap 'rm -f "$union" "$present" "$doomed"' EXIT
{
  for name in "${kept[@]}"; do cat "${STATE_DIR}/${name}"; done
  printf '%s\n' "${PROTECTED[@]}"
} | LC_ALL=C sort -u > "$union"
# -P: never follow symlinks (-type f skips them); hidden paths (for example .well-known) are not
# release files. Lines are "<size>\t<relative path>".
(cd "$WEB_ROOT" && find -P . -type f ! -path '*/.*' -printf '%s\t%P\n') | LC_ALL=C sort -t $'\t' -k2,2 -u > "$present"

removed=0
freed=0
transition=0
if (( NOW - since < grace_seconds )); then
  transition=1
elif [[ -n "$LIVE_ID" && "$live_recorded" == "0" ]]; then
  # The release that served until now has no list (deployed before retention, or by an older
  # installer): its files cannot be told apart, so this run removes nothing.
  transition=1
else
  # Size and path of every present file that no kept release lists (batch: the first prune of a
  # host may remove tens of thousands of files).
  LC_ALL=C join -t $'\t' -1 2 -2 1 -v 1 -o 1.1,1.2 "$present" "$union" > "$doomed"
  removed="$(wc -l < "$doomed")"
  freed="$(awk -F '\t' '{ total += $1 } END { printf "%d", total }' "$doomed")"
  if [[ "$DRY_RUN" != "1" && "$removed" -gt 0 ]]; then
    (cd "$WEB_ROOT" && cut -f2- "$doomed" | xargs -r -d '\n' rm -f --)
    find -P "$WEB_ROOT" -mindepth 1 -type d -empty ! -path '*/.*' -delete
  fi
fi

if [[ "$DRY_RUN" != "1" ]]; then
  for name in "${dropped[@]}"; do rm -f -- "${STATE_DIR}/${name}"; done
fi

printf '{"webRoot":"%s","keptReleases":%d,"droppedLists":%d,"removedFiles":%d,"freedBytes":%d,"transition":%s,"dryRun":%s}\n' \
  "$WEB_ROOT" "${#kept[@]}" "${#dropped[@]}" "$removed" "$freed" \
  "$([[ "$transition" == 1 ]] && echo true || echo false)" "$([[ "$DRY_RUN" == 1 ]] && echo true || echo false)"
