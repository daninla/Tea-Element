import {
  CatalogRepository,
  type CatalogProduct,
  type Promotion,
} from '../src/modules/catalog/domain/catalog-repository';
export const now = new Date('2026-11-03T10:00:00Z');
export const promotion = (input: Partial<Promotion> = {}): Promotion => ({
  id: 'promotion',
  type: 'PERCENT',
  value: 10,
  startsAt: new Date('2026-01-01'),
  endsAt: new Date('2027-01-01'),
  isActive: true,
  ...input,
});
export const product: CatalogProduct = {
  id: 'product',
  slug: 'test-tea',
  name: 'Tea',
  nameOriginal: '茶',
  description: 'Tea',
  origin: 'Demo',
  year: 2025,
  brewingGuide: { temperatureCelsius: 90, seconds: 20, infusions: 5 },
  images: [],
  tags: [],
  createdAt: now,
  category: { id: 'category', slug: 'oolong', name: 'Улун', description: '', sortOrder: 0 },
  variants: [
    { id: 'small', sku: 'small', weightGrams: 25, price: 10001 },
    { id: 'large', sku: 'large', weightGrams: 100, price: 40000 },
  ],
  inventory: { stockGrams: 120, reservedGrams: 80 },
  promotions: [],
};
export function repository() {
  const methods = {
    categories: jest.fn().mockResolvedValue([]),
    list: jest.fn().mockResolvedValue({ products: [product], total: 1 }),
    bySlug: jest.fn().mockResolvedValue(product),
  };
  return { repository: methods as CatalogRepository, methods };
}
