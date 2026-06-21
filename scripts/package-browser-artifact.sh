#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${REPO_ROOT}/dist/app/browser"
RELEASES_DIR="${REPO_ROOT}/releases"

log() { printf '[mnscloud-app] %s\n' "$*"; }
die() { printf '[mnscloud-app] ERROR: %s\n' "$*" >&2; exit 1; }

cd "$REPO_ROOT"

version="$(tr -d '[:space:]' < VERSION)"
[[ "$version" =~ ^[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?$ ]] ||
  die "invalid VERSION value: ${version:-empty}"

[[ -d "$BUILD_DIR" ]] || die "browser build output not found at ${BUILD_DIR}"
[[ -f "${BUILD_DIR}/index.html" ]] || die "browser build is missing index.html"

validate_browser_assets() {
  local root="$1"
  local index_file="${root}/index.html"
  local missing=0
  local asset

  while IFS= read -r asset; do
    [[ -n "$asset" ]] || continue
    if [[ ! -f "${root}/${asset}" ]]; then
      printf '[mnscloud-app] ERROR: browser build references missing asset: %s\n' "$asset" >&2
      missing=1
    fi
  done < <(grep -Eo '(main|polyfills|styles|chunk)-[A-Za-z0-9_-]+[.](js|css)' "$index_file" | sort -u)

  [[ "$missing" == "0" ]] || die "browser build asset validation failed"
}

validate_browser_assets "$BUILD_DIR"

mkdir -p "$RELEASES_DIR"
rm -f "${RELEASES_DIR}"/mnscloud-app-browser-v*.tar.gz \
  "${RELEASES_DIR}"/mnscloud-app-browser-v*.tar.gz.sha256

artifact_name="mnscloud-app-browser-v${version}.tar.gz"
artifact_path="${RELEASES_DIR}/${artifact_name}"
sha_path="${artifact_path}.sha256"

log "packaging browser artifact ${artifact_name}"
tar -C "$BUILD_DIR" \
  --sort=name \
  --mtime='UTC 1970-01-01' \
  --owner=0 \
  --group=0 \
  --numeric-owner \
  -czf "$artifact_path" .

sha256="$(sha256sum "$artifact_path" | awk '{print $1}')"
size_bytes="$(stat -c '%s' "$artifact_path")"
printf '%s  %s\n' "$sha256" "$artifact_name" > "$sha_path"

deno eval '
const [manifestPath, channel, artifactName, sha256, sizeBytes] = Deno.args;
const raw = await Deno.readTextFile(manifestPath);
const manifest = JSON.parse(raw);
manifest.channels ??= {};
manifest.channels[channel] ??= {};
manifest.channels[channel].artifact = {
  name: artifactName,
  sha256,
  sizeBytes: Number(sizeBytes),
  contentType: "application/gzip",
};
await Deno.writeTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
' releases/manifest.json stable "$artifact_name" "$sha256" "$size_bytes"

log "browser artifact ready: ${artifact_name} (${size_bytes} bytes)"
