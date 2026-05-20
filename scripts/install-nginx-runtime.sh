#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-mnscloud-app}"
APP_WEB_ROOT="${APP_WEB_ROOT:-/var/www/mnscloud-app}"
APP_LISTEN_ADDR="${APP_LISTEN_ADDR:-127.0.0.1}"
APP_LISTEN_PORT="${APP_LISTEN_PORT:-8080}"
APP_SERVER_NAME="${APP_SERVER_NAME:-_}"
APP_API_BASE_URL="${APP_API_BASE_URL:-}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/${APP_NAME}.conf}"
SKIP_BUILD="${SKIP_BUILD:-0}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${REPO_ROOT}/dist/app/browser"

log() { printf '[mnscloud-app] %s\n' "$*"; }
die() { printf '[mnscloud-app] ERROR: %s\n' "$*" >&2; exit 1; }
require_root() { [[ "${EUID}" -eq 0 ]] || die "this command must run as root"; }

detect_os() {
  [[ -r /etc/os-release ]] || die "/etc/os-release not found"
  # shellcheck disable=SC1091
  source /etc/os-release
  OS_ID="${ID:-}"
  OS_VERSION_ID="${VERSION_ID:-}"
  OS_PRETTY_NAME="${PRETTY_NAME:-$OS_ID $OS_VERSION_ID}"

  case "${OS_ID}:${OS_VERSION_ID}" in
    debian:12 | debian:13) OS_FAMILY="debian" ;;
    rhel:8* | rhel:9* | rocky:8* | rocky:9* | almalinux:8* | almalinux:9*) OS_FAMILY="rhel" ;;
    *) die "unsupported OS: ${OS_PRETTY_NAME}. Supported: Debian 12/13, RHEL/Rocky/AlmaLinux 8/9" ;;
  esac
}

install_packages() {
  if [[ "${OS_FAMILY}" == "debian" ]]; then
    apt-get update -y
    apt-get install -y --no-install-recommends nginx ca-certificates rsync
  else
    dnf install -y nginx ca-certificates rsync
  fi
}

reload_nginx() {
  nginx -t

  if command -v systemctl >/dev/null 2>&1; then
    systemctl enable nginx >/dev/null 2>&1 || true
    systemctl reload nginx >/dev/null 2>&1 || systemctl restart nginx
  else
    nginx -s reload >/dev/null 2>&1 || service nginx restart
  fi
}

require_root
detect_os
log "detected ${OS_PRETTY_NAME}"
install_packages

if ! command -v npm >/dev/null 2>&1; then
  die "npm is required before installing the ${APP_NAME} runtime"
fi

if [[ "${SKIP_BUILD}" != "1" ]]; then
  log "installing dependencies"
  npm --prefix "${REPO_ROOT}" ci
  log "building Angular app"
  npm --prefix "${REPO_ROOT}" run build
fi

if [[ ! -d "${BUILD_DIR}" ]]; then
  die "build output not found at ${BUILD_DIR}. Run npm run build or set SKIP_BUILD=0"
fi

log "deploying browser files to ${APP_WEB_ROOT}"
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

log "writing Nginx site ${NGINX_CONF_PATH}"
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

reload_nginx

echo "${APP_NAME} installed at ${APP_WEB_ROOT}"
echo "Nginx site: ${NGINX_CONF_PATH}"
echo "Local URL: http://${APP_LISTEN_ADDR}:${APP_LISTEN_PORT}"
