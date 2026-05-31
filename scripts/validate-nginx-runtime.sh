#!/usr/bin/env bash
set -Eeuo pipefail

APP_LISTEN_ADDR="${APP_LISTEN_ADDR:-127.0.0.1}"
APP_LISTEN_PORT="${APP_LISTEN_PORT:-8080}"
APP_HEALTH_URL="${APP_HEALTH_URL:-http://${APP_LISTEN_ADDR}:${APP_LISTEN_PORT}/health}"
NGINX_CONF_PATH="${NGINX_CONF_PATH:-/etc/nginx/conf.d/mnscloud-app.conf}"
MNSCLOUD_EDGE_ALLOWED_CIDRS="${MNSCLOUD_EDGE_ALLOWED_CIDRS:-}"

log() { printf '[mnscloud-app] %s\n' "$*"; }
die() { printf '[mnscloud-app] ERROR: %s\n' "$*" >&2; exit 1; }

[[ -f "$NGINX_CONF_PATH" ]] || die "Nginx site not found: $NGINX_CONF_PATH"
nginx -t

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet nginx || die "nginx service is not active"
fi

if command -v curl >/dev/null 2>&1; then
  curl -fsS "$APP_HEALTH_URL" >/dev/null || die "app health check failed: $APP_HEALTH_URL"
fi

if [[ -n "$MNSCLOUD_EDGE_ALLOWED_CIDRS" ]] && command -v nft >/dev/null 2>&1; then
  nft list table inet mnscloud_app_edge_guard >/dev/null ||
    die "edge firewall table not found: mnscloud_app_edge_guard"
fi

log "validation OK"
