import type { ProductView } from '@tea/contracts';
import type { CatalogProduct, Promotion } from './catalog-repository';
export function effectivePrice(price: number, promotions: Promotion[], now: Date): number {
  if (!Number.isSafeInteger(price) || price < 0) throw new Error('Invalid catalog price');
  return promotions.reduce((best, p) => {
    if (
      !p.isActive ||
      p.startsAt > now ||
      p.endsAt <= now ||
      !Number.isSafeInteger(p.value) ||
      p.value < 0 ||
      (p.type === 'PERCENT' && p.value > 100)
    )
      return best;
    const discount =
      p.type === 'PERCENT' ? Number((BigInt(price) * BigInt(p.value)) / 100n) : p.value;
    return Math.min(best, Math.max(0, price - discount));
  }, price);
}
export function productView(product: CatalogProduct, now: Date): ProductView {
  const available = Math.max(
    0,
    (product.inventory?.stockGrams ?? 0) - (product.inventory?.reservedGrams ?? 0),
  );
  const variants = product.variants.map((v) => {
    const price = effectivePrice(v.price, product.promotions, now);
    return {
      id: v.id,
      sku: v.sku,
      weightGrams: v.weightGrams,
      originalPrice: v.price,
      price,
      onSale: price < v.price,
      inStock: available >= v.weightGrams,
    };
  });
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    nameOriginal: product.nameOriginal,
    description: product.description,
    origin: product.origin,
    year: product.year,
    brewingGuide: product.brewingGuide,
    images: product.images,
    tags: product.tags,
    category: product.category,
    variants,
    minPrice: Math.min(...variants.map((v) => v.price)),
    onSale: variants.some((v) => v.onSale),
    inStock: variants.some((v) => v.inStock),
    createdAt: product.createdAt.toISOString(),
  };
}
