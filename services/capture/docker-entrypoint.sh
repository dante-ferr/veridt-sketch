#!/bin/sh
set -eu
DIR=/var/lib/veridit
mkdir -p "$DIR"
if [ ! -s "$DIR/manifest-private.pem" ]; then
  node /app/services/capture/scripts/generate-signing-key.mjs "$DIR/manifest-private.pem"
  chmod 600 "$DIR/manifest-private.pem"
fi
export MANIFEST_PRIVATE_KEY_PATH="$DIR/manifest-private.pem"
cd /app/services/capture
npx prisma migrate deploy
exec node dist/main.js
