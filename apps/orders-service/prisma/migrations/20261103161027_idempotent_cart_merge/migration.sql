-- CreateTable
CREATE TABLE "cart_merges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_merges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cart_merges_user_id_key_key" ON "cart_merges"("user_id", "key");
