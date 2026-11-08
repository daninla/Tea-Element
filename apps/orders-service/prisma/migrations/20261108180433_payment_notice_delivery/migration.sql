-- CreateTable
CREATE TABLE "order_payment_notices" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UAH',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_id" UUID,
    "lease_until" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_payment_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_payment_notices_status_next_attempt_at_lease_until_idx" ON "order_payment_notices"("status", "next_attempt_at", "lease_until");

-- CreateIndex
CREATE INDEX "order_payment_notices_order_id_created_at_idx" ON "order_payment_notices"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_payment_notices_payment_id_kind_key" ON "order_payment_notices"("payment_id", "kind");

-- AddForeignKey
ALTER TABLE "order_payment_notices" ADD CONSTRAINT "order_payment_notices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
