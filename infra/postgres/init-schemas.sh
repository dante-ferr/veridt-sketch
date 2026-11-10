#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v identity_pw="$IDENTITY_DB_PASSWORD" \
  -v notification_pw="$NOTIFICATION_DB_PASSWORD" \
  -v capture_pw="$CAPTURE_DB_PASSWORD" \
  -v records_pw="$RECORDS_DB_PASSWORD" <<'EOF'
CREATE USER identity WITH PASSWORD :'identity_pw';
CREATE USER notification WITH PASSWORD :'notification_pw';
CREATE USER capture WITH PASSWORD :'capture_pw';
CREATE USER records WITH PASSWORD :'records_pw';
CREATE SCHEMA identity AUTHORIZATION identity;
CREATE SCHEMA notification AUTHORIZATION notification;
CREATE SCHEMA capture AUTHORIZATION capture;
CREATE SCHEMA records AUTHORIZATION records;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT CONNECT ON DATABASE veridit TO identity, notification, capture, records;
ALTER ROLE identity SET search_path TO identity;
ALTER ROLE notification SET search_path TO notification;
ALTER ROLE capture SET search_path TO capture;
ALTER ROLE records SET search_path TO records;
EOF
