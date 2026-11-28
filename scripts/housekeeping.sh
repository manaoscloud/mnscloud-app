#!/usr/bin/env bash
# Runtime retention; stdout is JSON lines, diagnostics go to stderr.
set -Eeuo pipefail

if [[ $# != 1 || ( "$1" != --apply && "$1" != --dry-run ) ]]; then
  printf 'Usage: %s --apply | --dry-run\n' "$0" >&2
  exit 2
fi
dry_run=false
[[ "$1" != --dry-run ]] || dry_run=true
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo="${MNSCLOUD_APP_REPO_DIR:-${script_dir}/..}"
web_root="${APP_WEB_ROOT:-/var/www/mnscloud-app}"
state_dir="${APP_RELEASE_STATE_DIR:-/var/lib/mnscloud/app/web-releases}"
keep="${MNSCLOUD_APP_KEEP_TAGS:-2}"
if [[ ! "$keep" =~ ^[0-9]+$ || ! "$keep" =~ [1-9] ]]; then
  printf '[housekeeping] MNSCLOUD_APP_KEEP_TAGS must be an integer >= 1\n' >&2
  exit 1
fi
# Normalize decimal input; very large counts simply keep all eligible tags.
while [[ "$keep" == 0* ]]; do keep="${keep#0}"; done

if [[ ! -e "$web_root" ]]; then
  printf '{"kind":"web-root","skipped":"web root missing","freedBytes":0}\n'
else
  live_release="$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([0-9A-Za-z.+_-]*\)".*/\1/p' \
    "${web_root}/build.json" 2>/dev/null | head -n 1 || true)"
  args=(--web-root "$web_root" --state-dir "$state_dir" --live-release "$live_release")
  [[ "$dry_run" == false ]] || args+=(--dry-run)
  errors="$(mktemp)"
  trap 'rm -f -- "$errors"' EXIT
  if summary="$(bash "${script_dir}/prune-web-root.sh" "${args[@]}" 2>"$errors")"; then
    cat "$errors" >&2
    printf '%s\n' "$summary" | sed 's/^{/{"kind":"web-root",/'
  else
    status=$?
    cat "$errors" >&2
    if grep -qxF '[prune-web-root] ERROR: no release list recorded; nothing is pruned' "$errors"; then
      printf '{"kind":"web-root","skipped":"no release list recorded","freedBytes":0}\n'
    else
      exit "$status"
    fi
  fi
  rm -f -- "$errors"
  trap - EXIT
fi

if [[ "$(git -C "$repo" rev-parse --is-inside-work-tree 2>/dev/null || true)" != true ]]; then
  printf '{"kind":"git","skipped":"not a git work tree","freedBytes":0}\n'
  exit 0
fi
cd -- "$repo"
git_dir="$(git rev-parse --absolute-git-dir)"
bytes_before="$(du -s -B1 -x -- "$git_dir" | cut -f1)"
head_tags="$(git tag --points-at HEAD)"
all_tags="$(git tag --sort=-v:refname)"
remove_tags=()
kept=0
while IFS= read -r tag; do
  [[ -n "$tag" ]] || continue
  if grep -qxF -- "$tag" <<< "$head_tags"; then
    continue
  fi
  if [[ "$tag" =~ ^v[0-9]+[.][0-9]+[.][0-9]+$ ]] && \
    { [[ ${#keep} -gt 9 ]] || (( kept < keep )); }; then
    kept=$((kept + 1))
  else
    remove_tags+=("$tag")
  fi
done <<< "$all_tags"
remote_refs="$(git for-each-ref --format='%(refname)' refs/remotes/origin/)"
remove_refs=()
while IFS= read -r ref; do
  case "$ref" in
    ''|refs/remotes/origin/main|refs/remotes/origin/HEAD) ;;
    *) remove_refs+=("$ref") ;;
  esac
done <<< "$remote_refs"
bytes_after="$bytes_before"
freed=0
if [[ "$dry_run" == false ]]; then
  for ((offset = 0; offset < ${#remove_tags[@]}; offset += 100)); do
    git tag -d -- "${remove_tags[@]:offset:100}" >&2
  done
  for ref in "${remove_refs[@]}"; do
    git update-ref --no-deref -d "$ref"
  done
  git reflog expire --expire=now --all >&2
  git gc --prune=now --quiet >&2
  bytes_after="$(du -s -B1 -x -- "$git_dir" | cut -f1)"
  freed=$((bytes_before - bytes_after))
  (( freed >= 0 )) || freed=0
fi
printf '{"kind":"git","tagsRemoved":%d,"refsRemoved":%d,"bytesBefore":%d,"bytesAfter":%d,"freedBytes":%d,"dryRun":%s}\n' \
  "${#remove_tags[@]}" "${#remove_refs[@]}" "$bytes_before" "$bytes_after" "$freed" "$dry_run"
