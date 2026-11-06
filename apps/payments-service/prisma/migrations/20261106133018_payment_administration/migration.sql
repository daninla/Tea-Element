-- CreateTable
CREATE TABLE "payment_admin_commands" (
    "attempted_at" TIMESTAMP(3),
    "id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_admin_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_admin_commands_key_key" ON "payment_admin_commands"("key");

-- CreateIndex
CREATE INDEX "payment_admin_commands_payment_id_created_at_idx" ON "payment_admin_commands"("payment_id", "created_at");

-- CreateIndex
CREATE INDEX "payment_admin_commands_attempted_at_created_at_idx" ON "payment_admin_commands"("attempted_at", "created_at");

-- CreateIndex
CREATE INDEX "payment_events_created_at_idx" ON "payment_events"("created_at");

-- CreateIndex
CREATE INDEX "payments_created_at_idx" ON "payments"("created_at");
