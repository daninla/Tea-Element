-- AlterTable
ALTER TABLE "customer_profiles" ADD COLUMN     "last_marketing_job_id" UUID;

-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "promotion_title" TEXT;

-- CreateTable
CREATE TABLE "campaign_settings" (
    "id" UUID NOT NULL,
    "campaign" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_commands" (
    "id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "campaign" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_snapshots" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "revision" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotion_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "campaign_settings_campaign_key" ON "campaign_settings"("campaign");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_commands_key_key" ON "campaign_commands"("key");

-- CreateIndex
CREATE INDEX "campaign_commands_created_at_idx" ON "campaign_commands"("created_at");

-- CreateIndex
CREATE INDEX "promotion_snapshots_active_starts_at_ends_at_idx" ON "promotion_snapshots"("active", "starts_at", "ends_at");
