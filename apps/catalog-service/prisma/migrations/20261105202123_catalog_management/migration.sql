-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "catalog_commands" (
    "id" UUID NOT NULL,
    "key" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "entity_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "before" JSONB,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_commands_key_key" ON "catalog_commands"("key");

-- CreateIndex
CREATE INDEX "catalog_commands_entity_id_created_at_idx" ON "catalog_commands"("entity_id", "created_at");
