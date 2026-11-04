-- DropIndex
DROP INDEX "payments_order_id_key";

-- CreateTable
CREATE TABLE "abandoned_attempts" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "abandoned_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "abandoned_attempts_payment_id_key" ON "abandoned_attempts"("payment_id");

-- CreateIndex
CREATE INDEX "abandoned_attempts_order_id_idx" ON "abandoned_attempts"("order_id");

-- CreateIndex
CREATE INDEX "payments_order_id_created_at_idx" ON "payments"("order_id", "created_at");
