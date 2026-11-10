#!/bin/sh
set -eu
cd /app/services/records
npx prisma migrate deploy
exec node dist/main.js
