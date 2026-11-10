-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "email_confirmed_at" TIMESTAMP(3),
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "profile" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lawyers" (
    "account_id" TEXT NOT NULL,
    "cpf_ciphertext" TEXT NOT NULL,
    "oab_ciphertext" TEXT NOT NULL,

    CONSTRAINT "lawyers_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "common_users" (
    "account_id" TEXT NOT NULL,
    "cpf_ciphertext" TEXT NOT NULL,

    CONSTRAINT "common_users_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "cpf_documents" (
    "hmac" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,

    CONSTRAINT "cpf_documents_pkey" PRIMARY KEY ("hmac")
);

-- CreateTable
CREATE TABLE "one_time_tokens" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "token_hmac" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "refresh_hmac" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cpf_documents_account_id_key" ON "cpf_documents"("account_id");

-- CreateIndex
CREATE UNIQUE INDEX "one_time_tokens_token_hmac_key" ON "one_time_tokens"("token_hmac");

-- CreateIndex
CREATE INDEX "one_time_tokens_account_id_purpose_created_at_idx" ON "one_time_tokens"("account_id", "purpose", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refresh_hmac_key" ON "sessions"("refresh_hmac");

-- AddForeignKey
ALTER TABLE "lawyers" ADD CONSTRAINT "lawyers_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "common_users" ADD CONSTRAINT "common_users_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpf_documents" ADD CONSTRAINT "cpf_documents_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "one_time_tokens" ADD CONSTRAINT "one_time_tokens_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

