/*
  Warnings:

  - A unique constraint covering the columns `[dedupe_key]` on the table `order_payment_notices` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "order_payment_notices" ADD COLUMN     "dedupe_key" TEXT,
ALTER COLUMN "payment_id" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "order_payment_notices_dedupe_key_key" ON "order_payment_notices"("dedupe_key");
