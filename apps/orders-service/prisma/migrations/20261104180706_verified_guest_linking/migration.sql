-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "lookup_requested_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "verified_identities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "verified_at" TIMESTAMP(3) NOT NULL,
    "last_linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verified_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "verified_identities_user_id_key" ON "verified_identities"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "verified_identities_email_key" ON "verified_identities"("email");

-- CreateIndex
CREATE INDEX "verified_identities_last_linked_at_idx" ON "verified_identities"("last_linked_at");

-- CreateIndex
CREATE INDEX "orders_customer_email_created_at_idx" ON "orders"("customer_email", "created_at");
