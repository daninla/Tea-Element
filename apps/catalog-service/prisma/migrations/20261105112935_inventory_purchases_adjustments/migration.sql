-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "low_stock_threshold_pieces" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "actor_id" UUID,
ADD COLUMN     "note" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "reference_id" UUID,
ALTER COLUMN "order_id" DROP NOT NULL,
ALTER COLUMN "event_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "inventory_commands" (
    "id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_batches" (
    "id" UUID NOT NULL,
    "command_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "purchase_price_total" INTEGER NOT NULL,
    "supplier" TEXT NOT NULL,
    "purchased_at" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_commands_key_key" ON "inventory_commands"("key");

-- CreateIndex
CREATE INDEX "inventory_commands_product_id_created_at_idx" ON "inventory_commands"("product_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_batches_command_id_key" ON "purchase_batches"("command_id");

-- CreateIndex
CREATE INDEX "purchase_batches_product_id_purchased_at_idx" ON "purchase_batches"("product_id", "purchased_at");
