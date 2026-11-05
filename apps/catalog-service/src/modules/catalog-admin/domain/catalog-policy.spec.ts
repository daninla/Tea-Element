import type { AdminProductInput } from '@tea/contracts';
import { validateProductUnit, validImagePath } from './catalog-policy';
const input = (): AdminProductInput => ({
  slug: 'tea',
  name: 'Tea',
  nameOriginal: '',
  description: 'Test tea',
  origin: '',
  year: null,
  brewingGuide: null,
  categoryId: 'category',
  images: [],
  tags: [],
  isActive: true,
  variants: [{ id: 'old', sku: 'tea-25', weightGrams: 25, price: 10000, isActive: true }],
});
it('accepts gram portions and a single piece variant', () => {
  expect(() => validateProductUnit(input(), 'TEA')).not.toThrow();
  const x = input();
  x.variants[0]!.weightGrams = null;
  expect(() => validateProductUnit(x, 'EQUIPMENT')).not.toThrow();
  expect(() => validateProductUnit(x, 'TEA')).toThrow();
});
it.each(['weightGrams', 'sku', 'id'] as const)(
  'keeps an existing variant %s immutable',
  (field) => {
    const old = input(),
      next = input();
    if (field === 'weightGrams') next.variants[0]!.weightGrams = 50;
    else next.variants[0]![field] = 'changed';
    expect(() => validateProductUnit(next, 'TEA', old.variants)).toThrow();
  },
);
it('allows price changes and deactivation without deleting old portions', () => {
  const old = input(),
    next = input();
  next.isActive = false;
  next.variants[0]!.price = 12345;
  next.variants[0]!.isActive = false;
  expect(() => validateProductUnit(next, 'TEA', old.variants)).not.toThrow();
  next.isActive = true;
  expect(() => validateProductUnit(next, 'TEA', old.variants)).toThrow();
});
it('rejects duplicate portions, IDs and piece brewing guides', () => {
  const x = input();
  x.variants.push({ ...x.variants[0]!, sku: 'other', weightGrams: 50 });
  expect(() => validateProductUnit(x, 'TEA')).toThrow();
  x.variants[1]!.id = 'new';
  x.variants[1]!.weightGrams = 25;
  expect(() => validateProductUnit(x, 'TEA')).toThrow();
  x.variants = [{ sku: 'cup', weightGrams: null, price: 100, isActive: true }];
  x.brewingGuide = { temperatureCelsius: 90, seconds: 30, infusions: 5 };
  expect(() => validateProductUnit(x, 'EQUIPMENT')).toThrow();
});
it('allows only bundled or canonical registered media paths', () => {
  expect(validImagePath('/images/tea-cup.png')).toBe(true);
  expect(validImagePath('/media/123e4567-e89b-12d3-a456-426614174000.webp')).toBe(true);
  for (const x of [
    'https://example.com/a.png',
    '/media/../../secret.webp',
    '/images/unknown.png',
    '/media/------------------------------------.webp',
  ])
    expect(validImagePath(x)).toBe(false);
});
