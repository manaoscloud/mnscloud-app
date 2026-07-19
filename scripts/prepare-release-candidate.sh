#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR=""
SOURCE_SHA=""
EXPLICIT_VERSION=""

usage() {
  cat <<'EOF'
Usage: bash scripts/prepare-release-candidate.sh --output <directory> --source-sha <sha> [--version <version>]

Builds the browser bundle once, packages it with the next semantic patch version and writes a
promotion payload. The payload is the only artifact accepted by the release workflow.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output) OUTPUT_DIR="${2:-}"; shift 2 ;;
    --source-sha) SOURCE_SHA="${2:-}"; shift 2 ;;
    --version) EXPLICIT_VERSION="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; exit 2 ;;
  esac
done

[[ -n "$OUTPUT_DIR" ]] || { usage >&2; exit 2; }
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo 'source SHA must be a full Git SHA' >&2; exit 2; }

cd "$REPO_ROOT"

current_version="$(tr -d '[:space:]' < VERSION)"
latest_tag_version="$(git tag --list 'v[0-9]*' --sort=-v:refname | head -n 1 | sed 's/^v//')"

if [[ -n "$EXPLICIT_VERSION" ]]; then
  version="$EXPLICIT_VERSION"
else
  version="$(deno eval '
const versions = Deno.args.filter(Boolean);
const parse = (value) => {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) throw new Error(`invalid semantic version: ${value}`);
  return match.slice(1, 4).map(Number);
};
const highest = versions.map((value) => ({ value, parts: parse(value) })).sort((a, b) =>
  b.parts[0] - a.parts[0] || b.parts[1] - a.parts[1] || b.parts[2] - a.parts[2],
)[0];
console.log(`${highest.parts[0]}.${highest.parts[1]}.${highest.parts[2] + 1}`);
' "$current_version" "$latest_tag_version")"
fi
[[ "$version" =~ ^[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?$ ]] || {
  echo "version must be a semantic version; found ${version:-empty}" >&2
  exit 1
}
released_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

deno eval '
const [version, releasedAt, sourceSha] = Deno.args;
for (const file of ["VERSION"]) await Deno.writeTextFile(file, `${version}\n`);
for (const file of ["package.json", "package-lock.json"]) {
  const data = JSON.parse(await Deno.readTextFile(file));
  data.version = version;
  if (data.packages?.[""]) data.packages[""].version = version;
  await Deno.writeTextFile(file, `${JSON.stringify(data, null, 2)}\n`);
}
const manifestPath = "releases/manifest.json";
const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
manifest.channels ??= {};
manifest.channels.stable = {
  ...(manifest.channels.stable ?? {}),
  version,
  ref: `v${version}`,
  releasedAt,
  sourceSha,
};
delete manifest.channels.stable.artifact;
await Deno.writeTextFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
' "$version" "$released_at" "$SOURCE_SHA"

deno run --allow-read --allow-write scripts/write-app-build-info.ts
npm run build
bash scripts/package-browser-artifact.sh

artifact_name="mnscloud-app-browser-v${version}.tar.gz"
artifact_path="releases/${artifact_name}"
sha256="$(sha256sum "$artifact_path" | awk '{print $1}')"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/payload/src/app" "$OUTPUT_DIR/payload/releases"
cp VERSION package.json package-lock.json "$OUTPUT_DIR/payload/"
cp src/app/app-build-info.ts "$OUTPUT_DIR/payload/src/app/"
cp releases/manifest.json "$artifact_path" "${artifact_path}.sha256" "$OUTPUT_DIR/payload/releases/"

deno eval '
const [path, sourceSha, version, artifactName, sha256, releasedAt] = Deno.args;
await Deno.writeTextFile(path, `${JSON.stringify({
  product: "mnscloud-app",
  sourceSha,
  version,
  artifactName,
  sha256,
  releasedAt,
}, null, 2)}\n`);
' "$OUTPUT_DIR/release-candidate.json" "$SOURCE_SHA" "$version" "$artifact_name" "$sha256" "$released_at"

printf '[mnscloud-app] release candidate ready: v%s from %s\n' "$version" "$SOURCE_SHA"
