-- CreateTable
CREATE TABLE "email_challenges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "mailed_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_challenges_token_hash_key" ON "email_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "email_challenges_user_id_kind_created_at_idx" ON "email_challenges"("user_id", "kind", "created_at");

-- CreateIndex
CREATE INDEX "email_challenges_mailed_at_next_attempt_at_idx" ON "email_challenges"("mailed_at", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "email_challenges" ADD CONSTRAINT "email_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
