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
NODE_MAJOR_VERSION="${NODE_MAJOR_VERSION:-24}"

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

install_nginx_org_repository() {
  if [[ "${OS_FAMILY}" == "debian" ]]; then
    apt-get update -y
    apt-get install -y --no-install-recommends curl gnupg2 ca-certificates lsb-release debian-archive-keyring

    curl -fsSL https://nginx.org/keys/nginx_signing.key \
      | gpg --dearmor \
      | tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null

    local codename="${OS_VERSION_CODENAME:-}"
    if [[ -z "${codename}" ]]; then
      codename="$(lsb_release -cs)"
    fi

    cat > /etc/apt/sources.list.d/nginx.list <<EOF
deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] https://nginx.org/packages/debian ${codename} nginx
EOF

    cat > /etc/apt/preferences.d/99nginx <<'EOF'
Package: *
Pin: origin nginx.org
Pin: release o=nginx
Pin-Priority: 900
EOF
  else
    dnf install -y yum-utils ca-certificates curl
    cat > /etc/yum.repos.d/nginx.repo <<'EOF'
[nginx-stable]
name=nginx stable repo
baseurl=https://nginx.org/packages/centos/$releasever/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true

[nginx-mainline]
name=nginx mainline repo
baseurl=https://nginx.org/packages/mainline/centos/$releasever/$basearch/
gpgcheck=1
enabled=0
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF
  fi
}

install_packages() {
  install_nginx_org_repository

  if [[ "${OS_FAMILY}" == "debian" ]]; then
    apt-get update -y
    apt-get install -y --no-install-recommends nginx ca-certificates rsync
  else
    dnf install -y nginx ca-certificates rsync
  fi
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
