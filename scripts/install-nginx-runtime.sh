#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-mnscloud-app}"
APP_WEB_ROOT="${APP_WEB_ROOT:-/var/www/mnscloud-app}"
APP_LISTEN_ADDR="${APP_LISTEN_ADDR:-127.0.0.1}"
APP_LISTEN_PORT="${APP_LISTEN_PORT:-8080}"
APP_SERVER_NAME="${APP_SERVER_NAME:-_}"
APP_API_BASE_URL="${APP_API_BASE_URL:-}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/${APP_NAME}.conf}"
SKIP_BUILD="${SKIP_BUILD:-0}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root, for example: sudo $0" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${REPO_ROOT}/dist/app/browser"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required before installing the ${APP_NAME} runtime." >&2
  exit 1
fi

if [[ ! -f /etc/os-release ]]; then
  echo "Cannot detect the operating system. This installer supports Debian/Ubuntu hosts." >&2
  exit 1
fi

# shellcheck disable=SC1091
. /etc/os-release

case "${ID:-}" in
  debian | ubuntu)
    apt-get update
    apt-get install -y --no-install-recommends nginx ca-certificates rsync
    ;;
  *)
    echo "Unsupported OS '${ID:-unknown}'. Install Nginx manually and use nginx/default.conf as a reference." >&2
    exit 1
    ;;
esac

if [[ "${SKIP_BUILD}" != "1" ]]; then
  npm --prefix "${REPO_ROOT}" ci
  npm --prefix "${REPO_ROOT}" run build
fi

if [[ ! -d "${BUILD_DIR}" ]]; then
  echo "Build output not found at ${BUILD_DIR}. Run npm run build or set SKIP_BUILD=0." >&2
  exit 1
fi

install -d -m 0755 "${APP_WEB_ROOT}"
rsync -a --delete "${BUILD_DIR}/" "${APP_WEB_ROOT}/"

APP_API_BASE_URL="${APP_API_BASE_URL}" node <<'NODE' > "${APP_WEB_ROOT}/env.js"
const apiBaseUrl = process.env.APP_API_BASE_URL || "";
process.stdout.write(`(function (window) {
  window.MNSCLOUD_APP_CONFIG = window.MNSCLOUD_APP_CONFIG || {
    apiBaseUrl: ${JSON.stringify(apiBaseUrl)},
  };
})(window);
`);
NODE

cat > "${NGINX_CONF_PATH}" <<EOF
server {
  listen ${APP_LISTEN_ADDR}:${APP_LISTEN_PORT};
  server_name ${APP_SERVER_NAME};

  root ${APP_WEB_ROOT};
  index index.html;

  location = /health {
    access_log off;
    default_type text/plain;
    return 200 "ok\\n";
  }

  location = /api {
    return 404;
  }

  location ^~ /api/ {
    return 404;
  }

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  location ~* \\.(?:css|js|mjs|ico|gif|jpe?g|png|svg|webp|woff2?)\$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files \$uri =404;
  }
}
EOF

nginx -t

if command -v systemctl >/dev/null 2>&1; then
  systemctl enable nginx >/dev/null 2>&1 || true
  systemctl reload nginx >/dev/null 2>&1 || systemctl restart nginx
else
  nginx -s reload >/dev/null 2>&1 || service nginx restart
fi

echo "${APP_NAME} installed at ${APP_WEB_ROOT}"
echo "Nginx site: ${NGINX_CONF_PATH}"
echo "Local URL: http://${APP_LISTEN_ADDR}:${APP_LISTEN_PORT}"
