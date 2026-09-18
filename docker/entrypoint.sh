#!/bin/sh
set -eu

: "${SUPABASE_URL:?SUPABASE_URL is required}"
: "${SUPABASE_PUBLISHABLE_KEY:?SUPABASE_PUBLISHABLE_KEY is required}"

case "$SUPABASE_URL" in
    https://*) ;;
    *) echo "SUPABASE_URL must use https://" >&2; exit 1 ;;
esac

case "$SUPABASE_URL$SUPABASE_PUBLISHABLE_KEY" in
    *"'"*|*'\\'*)
        echo "Supabase configuration contains unsupported characters" >&2
        exit 1
        ;;
esac

mkdir -p /tmp/runtime-config /tmp/nginx/client_temp /tmp/nginx/proxy_temp \
    /tmp/nginx/fastcgi_temp /tmp/nginx/uwsgi_temp /tmp/nginx/scgi_temp

cat > /tmp/runtime-config/config.js <<EOF
window.APP_CONFIG = Object.freeze({
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_PUBLISHABLE_KEY: '${SUPABASE_PUBLISHABLE_KEY}'
});
EOF

exec "$@"
