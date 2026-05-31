#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-mnscloud-app}"
APP_WEB_ROOT="${APP_WEB_ROOT:-/var/www/mnscloud-app}"
APP_LISTEN_ADDR="${APP_LISTEN_ADDR:-0.0.0.0}"
APP_LISTEN_PORT="${APP_LISTEN_PORT:-8080}"
APP_SERVER_NAME="${APP_SERVER_NAME:-_}"
APP_API_BASE_URL="${APP_API_BASE_URL:-}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/${APP_NAME}.conf}"
DISABLE_DEFAULT_NGINX_CONF="${DISABLE_DEFAULT_NGINX_CONF:-1}"
SKIP_BUILD="${SKIP_BUILD:-0}"
NODE_MAJOR_VERSION="${NODE_MAJOR_VERSION:-24}"
APP_RUNTIME_KIT_DIR="${APP_RUNTIME_KIT_DIR:-/opt/mnscloud/runtime-kit}"
APP_RUNTIME_KIT_REPO_URL="${APP_RUNTIME_KIT_REPO_URL:-https://github.com/manaoscloud/mnscloud-runtime-kit.git}"
APP_RUNTIME_KIT_REF="${APP_RUNTIME_KIT_REF:-}"
APP_RUNTIME_KIT_CHANNEL="${APP_RUNTIME_KIT_CHANNEL:-stable}"

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
  OS_VERSION_CODENAME="${VERSION_CODENAME:-}"
  OS_PRETTY_NAME="${PRETTY_NAME:-$OS_ID $OS_VERSION_ID}"

  case "${OS_ID}:${OS_VERSION_ID}" in
    debian:12 | debian:13) OS_FAMILY="debian" ;;
    rhel:9* | rhel:10* | rocky:9* | rocky:10* | almalinux:9* | almalinux:10*) OS_FAMILY="rhel" ;;
    *) die "unsupported OS: ${OS_PRETTY_NAME}. Supported: Debian 12/13, RHEL/Rocky/AlmaLinux 9/10" ;;
  esac
}

install_packages() {
  if [[ "${OS_FAMILY}" == "debian" ]]; then
    apt-get update -y
    apt-get install -y --no-install-recommends ca-certificates curl git rsync
  else
    dnf install -y ca-certificates curl git rsync
  fi
}

load_runtime_kit() {
  if [[ -d "${APP_RUNTIME_KIT_DIR}/.git" ]]; then
    log "updating runtime kit in ${APP_RUNTIME_KIT_DIR}"
    git -C "$APP_RUNTIME_KIT_DIR" fetch --all --tags --prune
  else
    log "installing runtime kit in ${APP_RUNTIME_KIT_DIR}"
    install -d -m 0755 "$(dirname "$APP_RUNTIME_KIT_DIR")"
    git clone "$APP_RUNTIME_KIT_REPO_URL" "$APP_RUNTIME_KIT_DIR"
  fi

  if [[ -z "$APP_RUNTIME_KIT_REF" ]]; then
    APP_RUNTIME_KIT_REF="$(resolve_runtime_kit_ref "$APP_RUNTIME_KIT_DIR" "$APP_RUNTIME_KIT_CHANNEL")"
    log "resolved runtime kit ${APP_RUNTIME_KIT_CHANNEL} channel to ${APP_RUNTIME_KIT_REF}"
  fi

  git -C "$APP_RUNTIME_KIT_DIR" -c advice.detachedHead=false checkout "$APP_RUNTIME_KIT_REF"
  git -C "$APP_RUNTIME_KIT_DIR" pull --ff-only origin "$APP_RUNTIME_KIT_REF" 2>/dev/null || true
  [[ -r "${APP_RUNTIME_KIT_DIR}/lib/packages.sh" ]] || die "runtime kit packages library not found"

  export MNSCLOUD_RUNTIME_KIT_LOG_PREFIX="mnscloud-app/runtime-kit"
  # shellcheck disable=SC1091
  source "${APP_RUNTIME_KIT_DIR}/lib/packages.sh"
}

resolve_runtime_kit_ref() {
  local kit_dir="$1"
  local channel="$2"
  local manifest ref

  manifest="$(git -C "$kit_dir" show "origin/main:releases/manifest.json" 2>/dev/null)" ||
    die "cannot read runtime kit release manifest from origin/main"
  ref="$(printf '%s\n' "$manifest" | awk -v channel="$channel" '
    $0 ~ "\"" channel "\"" { in_channel = 1; next }
    in_channel && /"ref"[[:space:]]*:/ {
      gsub(/.*"ref"[[:space:]]*:[[:space:]]*"/, "")
      gsub(/".*/, "")
      print
      exit
    }
    in_channel && /^[[:space:]]*}/ { in_channel = 0 }
  ')"
  [[ "$ref" =~ ^v[0-9]+[.][0-9]+[.][0-9]+([-+][0-9A-Za-z.-]+)?$ ]] ||
    die "invalid runtime kit ref for channel ${channel}: ${ref:-empty}"
  printf '%s\n' "$ref"
}

install_nginx_package() {
  load_runtime_kit
  mrtk_install_nginx_package
}

node_major_version() {
  if ! command -v node >/dev/null 2>&1; then
    printf '0'
    return 0
  fi

  node -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || printf '0'
}

nodejs_is_usable() {
  local major
  major="$(node_major_version)"
  [[ "${major}" -ge "${NODE_MAJOR_VERSION}" ]] && command -v npm >/dev/null 2>&1
}

install_nodejs() {
  if nodejs_is_usable; then
    log "Node.js $(node -v) and npm $(npm -v) already available"
    return 0
  fi

  log "installing Node.js ${NODE_MAJOR_VERSION}.x runtime"
  if [[ "${OS_FAMILY}" == "debian" ]]; then
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR_VERSION}.x" | bash -
    apt-get install -y --no-install-recommends nodejs
  else
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR_VERSION}.x" | bash -
    dnf install -y nodejs
  fi

  nodejs_is_usable || die "Node.js ${NODE_MAJOR_VERSION}.x with npm is required before building ${APP_NAME}"
  log "using Node.js $(node -v) and npm $(npm -v)"
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
install_nginx_package
install_nodejs

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
if [[ "${DISABLE_DEFAULT_NGINX_CONF}" == "1" ]]; then
  rm -f /etc/nginx/conf.d/default.conf
fi

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
