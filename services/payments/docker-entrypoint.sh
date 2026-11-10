#!/bin/sh
set -eu
cd /app/services/payments
npx prisma migrate deploy
exec node dist/main.js
