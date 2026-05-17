#!/bin/sh
set -eu

API_BASE_URL="${MNSCLOUD_API_BASE_URL:-}"

cat > /app/public/env.js <<EOF
(function (window) {
  window.MNSCLOUD_APP_CONFIG = {
    apiBaseUrl: "${API_BASE_URL}",
  };
})(window);
EOF

exec "$@"
