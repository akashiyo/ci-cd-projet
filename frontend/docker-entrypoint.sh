#!/bin/sh

set -eu

api_url=${REACT_APP_API_URL:-http://localhost:5000}
sed -i "s|__API_URL__|${api_url%/}|g" /usr/share/nginx/html/config.js

exec nginx -g "daemon off;"