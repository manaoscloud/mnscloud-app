#!/usr/bin/env bash
set -Eeuo pipefail

APP_LISTEN_ADDR="${APP_LISTEN_ADDR:-127.0.0.1}"
APP_LISTEN_PORT="${APP_LISTEN_PORT:-8080}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://${APP_LISTEN_ADDR}:${APP_LISTEN_PORT}/health}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/mnscloud-app.conf}"
APP_WEB_ROOT="${APP_WEB_ROOT:-/var/www/mnscloud-app}"
APP_VALIDATE_CONNECT_TIMEOUT_SECONDS="${APP_VALIDATE_CONNECT_TIMEOUT_SECONDS:-5}"
APP_VALIDATE_MAX_TIME_SECONDS="${APP_VALIDATE_MAX_TIME_SECONDS:-20}"
APP_VALIDATE_RETRY_COUNT="${APP_VALIDATE_RETRY_COUNT:-2}"
APP_VALIDATE_RETRY_DELAY_SECONDS="${APP_VALIDATE_RETRY_DELAY_SECONDS:-1}"

log() { printf '[mnscloud-app] %s\n' "$*"; }
die() { printf '[mnscloud-app] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$NGINX_CONF_PATH" ]] || die "Nginx site not found: $NGINX_CONF_PATH"
nginx -t

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet nginx || die "nginx service is not active"
fi

if command -v curl >/dev/null 2>&1; then
  curl -fsS \
    --connect-timeout "$APP_VALIDATE_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$APP_VALIDATE_MAX_TIME_SECONDS" \
    --retry "$APP_VALIDATE_RETRY_COUNT" \
    --retry-delay "$APP_VALIDATE_RETRY_DELAY_SECONDS" \
    --retry-all-errors \
    "$APP_HEALTH_URL" >/dev/null || die "app health check failed: $APP_HEALTH_URL"

  i18n_url="${APP_HEALTH_URL%/health}/i18n/pt-BR.json"
  i18n_headers="$(curl -fsSI \
    --connect-timeout "$APP_VALIDATE_CONNECT_TIMEOUT_SECONDS" \
    --max-time "$APP_VALIDATE_MAX_TIME_SECONDS" \
    --retry "$APP_VALIDATE_RETRY_COUNT" \
    --retry-delay "$APP_VALIDATE_RETRY_DELAY_SECONDS" \
    --retry-all-errors \
    "$i18n_url")" || die "translation catalog is unavailable: $i18n_url"
  grep -qi '^cache-control:.*no-cache' <<<"$i18n_headers" ||
    die "translation catalog must be served with revalidation: $i18n_url"
fi

[[ -f "${APP_WEB_ROOT}/index.html" ]] || die "index.html not found in ${APP_WEB_ROOT}"
missing=0
while IFS= read -r asset; do
  [[ -n "$asset" ]] || continue
  if [[ ! -f "${APP_WEB_ROOT}/${asset}" ]]; then
    printf '[mnscloud-app] ERROR: deployed asset is missing: %s\n' "$asset" >&2
    missing=1
  fi
done < <(
  {
    grep -Eo '(main|polyfills|styles|chunk)-[A-Za-z0-9_-]+[.](js|css)' "${APP_WEB_ROOT}/index.html" || true
    find "$APP_WEB_ROOT" -maxdepth 1 -type f -name '*.js' -print0 |
      xargs -0 grep -hEo 'chunk-[A-Za-z0-9_-]+[.]js' 2>/dev/null || true
  } | sort -u
)
[[ "$missing" == "0" ]] || die "deployed browser asset validation failed"

log "validation OK"
