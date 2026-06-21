#!/usr/bin/env bash
set -Eeuo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="/etc/mnscloud/app.env"
CHANNEL="stable"
API_BASE="${MNSCLOUD_RELEASE_API_BASE_URL:-${MNSCLOUD_API_BASE_URL:-${APP_API_BASE_URL:-}}}"
PRINT_COMMAND=0

usage() {
  cat <<'EOF'
Usage:
  sudo ./scripts/update-latest-nginx-runtime.sh --api-base https://dev.publichost.cloud/api/v1 [--channel stable] [--env /etc/mnscloud/app.env] [--print-command]

This helper resolves the latest approved mnscloud-app release from the MNSCloud API registry,
then calls update-nginx-runtime.sh with the required release ref, artifact URL, and SHA-256.

Use this on app runtime hosts when the control plane/Agent flow is unavailable.
Use --print-command to inspect the resolved update command without applying it.
For other environments, replace only the --api-base value with that environment's public edge API
v1 URL.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-base) API_BASE="${2:-}"; shift 2 ;;
    --channel) CHANNEL="${2:-}"; shift 2 ;;
    --env) ENV_FILE="${2:-}"; shift 2 ;;
    --print-command) PRINT_COMMAND=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) printf '[mnscloud-app] ERROR: unknown argument: %s\n' "$1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  API_BASE="${MNSCLOUD_RELEASE_API_BASE_URL:-${MNSCLOUD_API_BASE_URL:-${APP_API_BASE_URL:-$API_BASE}}}"
fi

if [[ -z "$API_BASE" ]]; then
  printf '[mnscloud-app] ERROR: --api-base is required when no release API base is configured.\n' >&2
  usage >&2
  exit 1
fi

API_BASE="${API_BASE%/}"
if [[ "$API_BASE" != */api/v1 ]]; then
  API_BASE="${API_BASE}/api/v1"
fi

export MNSCLOUD_APP_RELEASE_URL="${API_BASE}/runtime/releases/latest?product=mnscloud-app&channel=${CHANNEL}"

eval "$(
python3 <<'PY'
import json
import os
import sys
import urllib.error
import urllib.request

url = os.environ["MNSCLOUD_APP_RELEASE_URL"]
try:
    with urllib.request.urlopen(url, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))
except urllib.error.HTTPError as exc:
    body = exc.read().decode("utf-8", errors="replace")
    print(f"[mnscloud-app] ERROR: release lookup failed HTTP {exc.code}: {body}", file=sys.stderr)
    sys.exit(1)
except Exception as exc:
    print(f"[mnscloud-app] ERROR: release lookup failed: {exc}", file=sys.stderr)
    sys.exit(1)

data = payload.get("data")
if not isinstance(data, dict):
    print("[mnscloud-app] ERROR: release lookup response did not include data", file=sys.stderr)
    sys.exit(1)

required = ("ref", "artifactUrl", "artifactSha256")
missing = [key for key in required if not data.get(key)]
if missing:
    print(f"[mnscloud-app] ERROR: release is missing required field(s): {', '.join(missing)}", file=sys.stderr)
    sys.exit(1)

for source, target in {
    "version": "VERSION",
    "ref": "REF",
    "buildRef": "BUILD_REF",
    "artifactUrl": "ARTIFACT_URL",
    "artifactSha256": "ARTIFACT_SHA256",
}.items():
    value = "" if data.get(source) is None else str(data.get(source))
    print(f"RELEASE_{target}={value!r}")
PY
)"

printf '[mnscloud-app] latest release: %s (%s, build %s)\n' \
  "${RELEASE_VERSION:-unknown}" "$RELEASE_REF" "${RELEASE_BUILD_REF:-unknown}"

if [[ "$PRINT_COMMAND" == "1" ]]; then
  cat <<EOF
cd $REPO_ROOT
sudo ./scripts/update-nginx-runtime.sh \\
  --ref '$RELEASE_REF' \\
  --artifact-url '$RELEASE_ARTIFACT_URL' \\
  --artifact-sha256 '$RELEASE_ARTIFACT_SHA256'
sudo ./scripts/validate-nginx-runtime.sh
EOF
  exit 0
fi

"$REPO_ROOT/scripts/update-nginx-runtime.sh" \
  --ref "$RELEASE_REF" \
  --artifact-url "$RELEASE_ARTIFACT_URL" \
  --artifact-sha256 "$RELEASE_ARTIFACT_SHA256"

"$REPO_ROOT/scripts/validate-nginx-runtime.sh"
