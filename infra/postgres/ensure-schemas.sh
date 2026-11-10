#!/bin/sh
set -eu
export PGPASSWORD="${POSTGRES_PASSWORD}"
psql -q -h postgres -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -v ON_ERROR_STOP=1 \
  -v capture_pw="$CAPTURE_DB_PASSWORD" \
  -v records_pw="$RECORDS_DB_PASSWORD" <<'EOF'
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'capture')
  THEN format('ALTER USER capture WITH PASSWORD %L', :'capture_pw')
  ELSE format('CREATE USER capture WITH PASSWORD %L', :'capture_pw')
END
\gexec
SELECT CASE
  WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'records')
  THEN format('ALTER USER records WITH PASSWORD %L', :'records_pw')
  ELSE format('CREATE USER records WITH PASSWORD %L', :'records_pw')
END
\gexec
CREATE SCHEMA IF NOT EXISTS capture AUTHORIZATION capture;
CREATE SCHEMA IF NOT EXISTS records AUTHORIZATION records;
GRANT CONNECT ON DATABASE veridit TO capture, records;
ALTER ROLE capture SET search_path TO capture;
ALTER ROLE records SET search_path TO records;
EOF
