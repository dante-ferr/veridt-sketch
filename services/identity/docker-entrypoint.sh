#!/bin/sh
set -eu
DIR=/var/lib/veridit
mkdir -p "$DIR"
if [ -z "${JWT_PRIVATE_KEY_PEM_B64:-}" ]; then
  if [ ! -s "$DIR/secrets.env" ]; then
    node /app/services/identity/scripts/generate-secrets.mjs > "$DIR/secrets.env"
    chmod 600 "$DIR/secrets.env"
  fi
  set -a
  # shellcheck disable=SC1090
  . "$DIR/secrets.env"
  set +a
fi
cd /app/services/identity
npx prisma migrate deploy
exec node dist/main.js
