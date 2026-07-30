#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_IF_CURRENT=0
RELEASE_REF=""

usage() {
  cat <<'EOF'
Usage: sync-runtime-release-cache.sh [--ref <published-tag>] [--skip-if-current]

Publishes the stable App release manifest to the MNSCloud runtime release catalog.
Required environment variables:
  MNSCLOUD_RELEASE_SYNC_URL
  MNSCLOUD_RELEASE_SYNC_TOKEN
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-if-current) SKIP_IF_CURRENT=1 ;;
    --ref)
      RELEASE_REF="${2:-}"
      [[ -n "$RELEASE_REF" ]] || {
        printf '[mnscloud-app] ERROR release-cache-invalid-argument: --ref requires a published tag\n' >&2
        exit 2
      }
      shift
      ;;
    -h|--help) usage; exit 0 ;;
    *) printf '[mnscloud-app] ERROR release-cache-invalid-argument: %s\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

[[ -n "${MNSCLOUD_RELEASE_SYNC_URL:-}" ]] || {
  printf '[mnscloud-app] ERROR release-cache-misconfigured: MNSCLOUD_RELEASE_SYNC_URL is required\n' >&2
  exit 2
}
[[ -n "${MNSCLOUD_RELEASE_SYNC_TOKEN:-}" ]] || {
  printf '[mnscloud-app] ERROR release-cache-misconfigured: MNSCLOUD_RELEASE_SYNC_TOKEN is required\n' >&2
  exit 2
}

cd "$REPO_ROOT"
payload_file="$(mktemp)"
response_file="$(mktemp)"
manifest_file="releases/manifest.json"
current_file=""

cleanup() {
  rm -f "$payload_file" "$response_file" "$current_file"
  [[ "$manifest_file" == "releases/manifest.json" ]] || rm -f "$manifest_file"
}
trap cleanup EXIT

if [[ -n "$RELEASE_REF" ]]; then
  [[ "$RELEASE_REF" =~ ^v[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?$ ]] || {
    printf '[mnscloud-app] ERROR release-cache-invalid-argument: invalid published tag %s\n' "$RELEASE_REF" >&2
    exit 2
  }
  manifest_file="$(mktemp)"
  git show "${RELEASE_REF}:releases/manifest.json" > "$manifest_file" || {
    printf '[mnscloud-app] ERROR release-cache-invalid-manifest: release manifest is unavailable for %s\n' "$RELEASE_REF" >&2
    exit 2
  }
fi

[[ -f "$manifest_file" ]] || {
  printf '[mnscloud-app] ERROR release-cache-invalid-manifest: releases/manifest.json was not found\n' >&2
  exit 2
}

python3 - "$manifest_file" "$RELEASE_REF" <<'PY' > "$payload_file"
import json
import subprocess
import sys

with open(sys.argv[1], encoding='utf-8') as handle:
    manifest = json.load(handle)
stable = manifest['channels']['stable']
artifact = stable['artifact']
ref = stable['ref']
requested_ref = sys.argv[2]
if requested_ref and ref != requested_ref:
    raise ValueError(f'release manifest ref {ref} does not match requested ref {requested_ref}')
repository = subprocess.check_output(
    ['git', 'config', '--get', 'remote.origin.url'], text=True
).strip().removesuffix('.git').removeprefix('https://github.com/')
build_ref = subprocess.check_output(['git', 'rev-list', '-n', '1', ref], text=True).strip()
print(json.dumps({
    'product': 'mnscloud-app',
    'channel': 'stable',
    'version': stable['version'],
    'ref': ref,
    'buildRef': build_ref[:12],
    'buildDate': stable['releasedAt'],
    'releasedAt': stable['releasedAt'],
    'notes': f'Synced from GitHub Actions release {ref}.',
    'artifactName': artifact['name'],
    'artifactUrl': f'https://github.com/{repository}/releases/download/{ref}/{artifact["name"]}',
    'artifactSha256': artifact['sha256'],
    'artifactSizeBytes': artifact['sizeBytes'],
    'artifactContentType': artifact['contentType'],
}))
PY

base_url="${MNSCLOUD_RELEASE_SYNC_URL%/}"
api_base="$base_url"
[[ "$api_base" == */api/v1 ]] || api_base="${api_base}/api/v1"
publish_endpoint="${api_base}/runtime/releases/publish"

if [[ "$SKIP_IF_CURRENT" == "1" ]]; then
  current_file="$(mktemp)"
  if curl --fail --silent --show-error --connect-timeout 10 --max-time 30 \
    "${api_base}/runtime/releases/latest?product=mnscloud-app&channel=stable" > "$current_file"; then
    if python3 - "$payload_file" "$current_file" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], encoding='utf-8'))
current = json.load(open(sys.argv[2], encoding='utf-8')).get('data') or {}
raise SystemExit(0 if all(
    current.get(key) == payload.get(key)
    for key in ('version', 'ref', 'buildRef', 'artifactSha256')
) else 1)
PY
    then
      printf '[mnscloud-app] release cache already synchronized: %s\n' "$(python3 -c 'import json; print(json.load(open("'$payload_file'"))["version"])')"
      exit 0
    fi
  else
    printf '[mnscloud-app] WARN release-cache-read-unavailable: publishing canonical release anyway\n' >&2
  fi
fi

if ! curl --fail-with-body --silent --show-error \
  --connect-timeout 10 --max-time 30 \
  --retry 4 --retry-all-errors --retry-delay 5 --retry-max-time 150 \
  -X POST \
  -H "Authorization: Bearer ${MNSCLOUD_RELEASE_SYNC_TOKEN}" \
  -H 'Content-Type: application/json' \
  --data @"$payload_file" \
  "$publish_endpoint" > "$response_file"; then
  printf '[mnscloud-app] ERROR release-cache-publication-failed: unable to publish the stable release catalog after retries\n' >&2
  [[ -s "$response_file" ]] && cat "$response_file" >&2
  exit 1
fi

printf '[mnscloud-app] release cache synchronized: %s\n' "$(python3 -c 'import json; print(json.load(open("'$payload_file'"))["version"])')"
cat "$response_file"
