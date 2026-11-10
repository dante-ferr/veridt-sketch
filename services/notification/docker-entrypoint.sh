#!/bin/sh
set -eu
cd /app/services/notification
npx prisma migrate deploy
exec node dist/main.js
