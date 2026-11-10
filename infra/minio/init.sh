#!/bin/sh
set -eu
export PATH="/opt/bitnami/minio-client/bin:${PATH}"
export MC_CONFIG_DIR="${MC_CONFIG_DIR:-/tmp/mc}"
mkdir -p "$MC_CONFIG_DIR"
mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
mc mb --ignore-existing --with-lock local/evidence || mc mb --ignore-existing local/evidence
mc version enable local/evidence
mc mb --ignore-existing local/artifacts
mc anonymous set none local/evidence
mc anonymous set none local/artifacts
mc admin user add local worker "$WORKER_S3_SECRET_KEY" || true
mc admin user add local capture "$CAPTURE_S3_SECRET_KEY" || true
mc admin user add local records "$RECORDS_S3_SECRET_KEY" || true
mc admin policy create local worker-write /policies/worker-policy.json || mc admin policy update local worker-write /policies/worker-policy.json
mc admin policy create local capture-sign /policies/capture-policy.json || mc admin policy update local capture-sign /policies/capture-policy.json
mc admin policy create local records-read /policies/records-policy.json || mc admin policy update local records-read /policies/records-policy.json
mc admin policy attach local worker-write --user worker
mc admin policy attach local capture-sign --user capture
mc admin policy attach local records-read --user records
echo "minio ready"
