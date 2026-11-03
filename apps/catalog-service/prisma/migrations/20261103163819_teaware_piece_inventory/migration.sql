-- CreateEnum
CREATE TYPE "CatalogSection" AS ENUM ('TEA', 'EQUIPMENT');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "section" "CatalogSection" NOT NULL DEFAULT 'TEA';

-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "reserved_pieces" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "stock_pieces" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "product_variants" ALTER COLUMN "weight_grams" DROP NOT NULL;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "brewing_guide" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "categories_section_is_active_idx" ON "categories"("section", "is_active");
