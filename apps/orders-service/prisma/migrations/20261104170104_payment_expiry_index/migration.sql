-- CreateIndex
CREATE INDEX "orders_status_payment_expires_at_idx" ON "orders"("status", "payment_expires_at");
