#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '[mnscloud-app] %s\n' "$*"; }
die() { printf '[mnscloud-app] ERROR: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Usage:
  ./scripts/release-app.sh --version <x.y.z> [--channel stable|candidate]

Creates release metadata, validates the Angular build, commits VERSION + manifest, and tags v<x.y.z>.
EOF
}

VERSION=""
CHANNEL="stable"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) VERSION="${2:-}"; shift 2 ;;
    --channel) CHANNEL="${2:-}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ "$VERSION" =~ ^[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?$ ]] || { usage; die "invalid version: ${VERSION:-empty}"; }
[[ "$CHANNEL" =~ ^(stable|candidate)$ ]] || die "invalid channel: $CHANNEL"

cd "$REPO_ROOT"
[[ -z "$(git status --short)" ]] || die "working tree must be clean before release"

TAG="v${VERSION}"
git rev-parse --verify --quiet "refs/tags/${TAG}" >/dev/null && die "tag already exists: ${TAG}"

printf '%s\n' "$VERSION" > VERSION
node - "$VERSION" <<'NODE'
const fs = require("node:fs");
const version = process.argv[2];
for (const file of ["package.json", "package-lock.json"]) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.version = version;
  if (data.packages?.[""]) data.packages[""].version = version;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}
NODE

mkdir -p releases
node - releases/manifest.json "$CHANNEL" "$VERSION" <<'NODE'
const fs = require("node:fs");
const [manifestPath, channel, version] = process.argv.slice(2);
const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
let manifest = {};
if (fs.existsSync(manifestPath)) {
  const raw = fs.readFileSync(manifestPath, "utf8").trim();
  if (raw) manifest = JSON.parse(raw);
}
manifest.product = "mnscloud-app";
manifest.repository = "manaoscloud/mnscloud-app";
manifest.channels ??= {};
manifest.channels[channel] = {
  version,
  ref: `v${version}`,
  releasedAt: now,
  minimumVersion: manifest.channels[channel]?.minimumVersion ?? "0.1.0",
  autoUpdate: false,
};
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
NODE

bash -n scripts/*.sh
npm run build

git add VERSION package.json package-lock.json releases/manifest.json
git commit -m "Release mnscloud-app ${TAG}"
git tag -a "$TAG" -m "Release mnscloud-app ${TAG}"
log "release metadata committed and tag created: ${TAG}"
