#!/bin/sh
set -e

# Substitute the RTMP push URL into nginx config
if [ -n "$RTMP_URL" ]; then
    sed -i "s|#PUSH_PLACEHOLDER|push ${RTMP_URL};|" /etc/nginx/nginx.conf
    echo "nginx-rtmp: push configured to ${RTMP_URL}"
else
    echo "nginx-rtmp: WARNING — no RTMP_URL set, no push target configured"
fi

exec nginx -g "daemon off;"
