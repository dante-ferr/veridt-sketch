-- CreateTable
CREATE TABLE "record_views" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "capture_kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "manifest_hash" TEXT,
    "manifest_key" TEXT,
    "signature" TEXT,
    "files" JSONB NOT NULL DEFAULT '[]',
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "record_id" TEXT,
    "trace_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "detail" JSONB NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "record_views_public_id_key" ON "record_views"("public_id");

-- CreateIndex
CREATE INDEX "record_views_account_id_created_at_idx" ON "record_views"("account_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_record_id_kind_key" ON "artifacts"("record_id", "kind");

CREATE OR REPLACE FUNCTION reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW
EXECUTE FUNCTION reject_audit_mutation();
