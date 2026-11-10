-- CreateTable
CREATE TABLE "content_records" (
    "id" TEXT NOT NULL,
    "public_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "capture_kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "manifest_hash" TEXT,
    "manifest_key" TEXT,
    "signature" TEXT,
    "session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_id_sequences" (
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "public_id_sequences_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_commands" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_records_public_id_key" ON "content_records"("public_id");

-- CreateIndex
CREATE INDEX "content_records_account_id_created_at_idx" ON "content_records"("account_id", "created_at");
