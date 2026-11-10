#!/bin/sh
set -eu
if [ ! -f /certs/cert.pem ]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
    -keyout /certs/key.pem -out /certs/cert.pem \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
fi
exec nginx -g 'daemon off;'
