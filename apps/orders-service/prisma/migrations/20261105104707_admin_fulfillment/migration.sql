-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "stock_deducted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_order_commands" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "from_status" "OrderStatus" NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_order_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_order_commands_order_id_created_at_idx" ON "admin_order_commands"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admin_order_commands_order_id_key_key" ON "admin_order_commands"("order_id", "key");
