#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-mnscloud-app}"
APP_WEB_ROOT="${APP_WEB_ROOT:-/var/www/mnscloud-app}"
APP_LISTEN_ADDR="${APP_LISTEN_ADDR:-0.0.0.0}"
APP_LISTEN_PORT="${APP_LISTEN_PORT:-8080}"
APP_SERVER_NAME="${APP_SERVER_NAME:-_}"
APP_API_BASE_URL="${APP_API_BASE_URL:-}"
APP_ARTIFACT_URL="${APP_ARTIFACT_URL:-}"
APP_ARTIFACT_PATH="${APP_ARTIFACT_PATH:-}"
APP_ARTIFACT_SHA256="${APP_ARTIFACT_SHA256:-}"
APP_ARTIFACT_NAME="${APP_ARTIFACT_NAME:-}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/${APP_NAME}.conf}"
DISABLE_DEFAULT_NGINX_CONF="${DISABLE_DEFAULT_NGINX_CONF:-1}"
APP_RUNTIME_KIT_DIR="${APP_RUNTIME_KIT_DIR:-/opt/mnscloud/runtime-kit}"
APP_RUNTIME_KIT_REPO_URL="${APP_RUNTIME_KIT_REPO_URL:-https://github.com/manaoscloud/mnscloud-runtime-kit.git}"
APP_RUNTIME_KIT_REF="${APP_RUNTIME_KIT_REF:-}"
APP_RUNTIME_KIT_CHANNEL="${APP_RUNTIME_KIT_CHANNEL:-stable}"
APP_UPDATE_CHANNEL="${APP_UPDATE_CHANNEL:-stable}"
APP_ARTIFACT_TMP_DIR=""

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '[mnscloud-app] %s\n' "$*"; }
die() { printf '[mnscloud-app] ERROR: %s\n' "$*" >&2; exit 1; }
require_root() { [[ "${EUID}" -eq 0 ]] || die "this command must run as root"; }

cleanup_artifact_tmp() {
  if [[ -n "${APP_ARTIFACT_TMP_DIR:-}" && -d "$APP_ARTIFACT_TMP_DIR" ]]; then
    rm -rf "$APP_ARTIFACT_TMP_DIR"
  fi
}

trap cleanup_artifact_tmp EXIT

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
    apt-get install -y --no-install-recommends ca-certificates curl git rsync tar
  else
    dnf install -y ca-certificates curl git rsync tar
  fi
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

load_runtime_kit() {
  if [[ "${APP_RUNTIME_KIT_LOADED:-0}" == "1" ]]; then
    return 0
  fi

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
  APP_RUNTIME_KIT_LOADED=1
}

install_nginx_package() {
  load_runtime_kit
  mrtk_install_nginx_package
}

js_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

write_env_js() {
  local escaped
  escaped="$(js_escape "$APP_API_BASE_URL")"
  cat > "${APP_WEB_ROOT}/env.js" <<EOF
(function (window) {
  window.MNSCLOUD_APP_CONFIG = window.MNSCLOUD_APP_CONFIG || {
    apiBaseUrl: "${escaped}",
  };
})(window);
EOF
}

write_build_metadata() {
  local version build_ref build_date git_ref metadata

  version="0.0.0"
  [[ -r "${REPO_ROOT}/VERSION" ]] && version="$(tr -d '[:space:]' < "${REPO_ROOT}/VERSION")"
  build_ref="$(git -C "$REPO_ROOT" rev-parse --short=12 HEAD 2>/dev/null || printf 'unknown')"
  build_date="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  git_ref="$(git -C "$REPO_ROOT" describe --tags --exact-match 2>/dev/null || printf '%s' "$build_ref")"
  metadata="$(cat <<EOF
{
  "product": "mnscloud-app",
  "version": "${version}",
  "buildRef": "${build_ref}",
  "buildDate": "${build_date}",
  "updateChannel": "${APP_UPDATE_CHANNEL}",
  "gitRef": "${git_ref}"
}
EOF
)"

  printf '%s\n' "$metadata" > "${REPO_ROOT}/build.json"
  printf '%s\n' "$metadata" > "${APP_WEB_ROOT}/build.json"
}

artifact_basename() {
  if [[ -n "$APP_ARTIFACT_NAME" ]]; then
    printf '%s\n' "$APP_ARTIFACT_NAME"
    return 0
  fi
  if [[ -n "$APP_ARTIFACT_PATH" ]]; then
    basename "$APP_ARTIFACT_PATH"
    return 0
  fi
  basename "${APP_ARTIFACT_URL%%\?*}"
}

fetch_artifact() {
  local target="$1"
  if [[ -n "$APP_ARTIFACT_PATH" ]]; then
    [[ -f "$APP_ARTIFACT_PATH" ]] || die "artifact file not found: ${APP_ARTIFACT_PATH}"
    cp "$APP_ARTIFACT_PATH" "$target"
    return 0
  fi
  [[ -n "$APP_ARTIFACT_URL" ]] || die "APP_ARTIFACT_URL or APP_ARTIFACT_PATH is required"
  [[ "$APP_ARTIFACT_URL" =~ ^https:// ]] || die "APP_ARTIFACT_URL must use HTTPS"
  curl -fsSL --retry 3 --retry-delay 2 -o "$target" "$APP_ARTIFACT_URL"
}

verify_artifact() {
  local file="$1"
  if [[ -z "$APP_ARTIFACT_SHA256" ]]; then
    die "APP_ARTIFACT_SHA256 is required"
  fi
  [[ "$APP_ARTIFACT_SHA256" =~ ^[0-9a-fA-F]{64}$ ]] || die "APP_ARTIFACT_SHA256 must be a SHA-256 hex digest"
  local actual
  actual="$(sha256sum "$file" | awk '{print $1}')"
  [[ "${actual,,}" == "${APP_ARTIFACT_SHA256,,}" ]] ||
    die "artifact checksum mismatch: expected ${APP_ARTIFACT_SHA256,,}, got ${actual,,}"
}

publish_artifact() {
  local artifact_path extract_dir artifact_name
  APP_ARTIFACT_TMP_DIR="$(mktemp -d)"
  artifact_name="$(artifact_basename)"
  artifact_path="${APP_ARTIFACT_TMP_DIR}/${artifact_name}"
  extract_dir="${APP_ARTIFACT_TMP_DIR}/browser"
  mkdir -p "$extract_dir"

  log "fetching browser artifact ${artifact_name}"
  fetch_artifact "$artifact_path"
  verify_artifact "$artifact_path"

  log "extracting browser artifact"
  tar -xzf "$artifact_path" -C "$extract_dir"
  [[ -f "${extract_dir}/index.html" ]] || die "artifact does not contain index.html at its root"

  log "deploying browser files to ${APP_WEB_ROOT}"
  install -d -m 0755 "${APP_WEB_ROOT}"
  rsync -a --delete "${extract_dir}/" "${APP_WEB_ROOT}/"
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

write_nginx_site() {
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
}

require_root
detect_os
log "detected ${OS_PRETTY_NAME}"
install_packages
install_nginx_package

if [[ -n "$APP_API_BASE_URL" ]]; then
  log "using explicit API base URL from APP_API_BASE_URL"
else
  log "using same-origin API base URL /api/v1"
fi

publish_artifact
write_build_metadata
write_env_js
write_nginx_site
reload_nginx

echo "${APP_NAME} installed at ${APP_WEB_ROOT}"
echo "Nginx site: ${NGINX_CONF_PATH}"
echo "Local URL: http://${APP_LISTEN_ADDR}:${APP_LISTEN_PORT}"
