-- CreateTable
CREATE TABLE "credit_packages" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "credit_count" INTEGER NOT NULL,
    "price_per_credit_cents" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "credit_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_orders" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "credit_count" INTEGER NOT NULL,
    "price_per_credit_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "provider_payment_id" TEXT NOT NULL,
    "pix_copy_paste" TEXT NOT NULL,
    "checkout_url" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "billing" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_charges" (
    "provider_payment_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "pix_copy_paste" TEXT NOT NULL,
    "checkout_url" TEXT NOT NULL,

    CONSTRAINT "provider_charges_pkey" PRIMARY KEY ("provider_payment_id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "credits" INTEGER NOT NULL,
    "record_id" TEXT,
    "order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_cache" (
    "account_id" TEXT NOT NULL,
    "available" INTEGER NOT NULL,

    CONSTRAINT "balance_cache_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "outbox" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "credit_packages_code_key" ON "credit_packages"("code");
CREATE UNIQUE INDEX "credit_orders_provider_payment_id_key" ON "credit_orders"("provider_payment_id");
CREATE INDEX "credit_orders_account_id_created_at_idx" ON "credit_orders"("account_id", "created_at");
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");
CREATE UNIQUE INDEX "ledger_entries_record_kind_key" ON "ledger_entries"("record_id", "kind") WHERE "record_id" IS NOT NULL;
CREATE UNIQUE INDEX "ledger_entries_order_kind_key" ON "ledger_entries"("order_id", "kind") WHERE "order_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$;

CREATE TRIGGER ledger_entries_append_only
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW
EXECUTE FUNCTION reject_ledger_mutation();
