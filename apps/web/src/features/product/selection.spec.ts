import type { VariantView } from '@tea/contracts';
import { selectedVariant, serializeJsonLd } from './selection';
const variants: VariantView[] = [
  {
    id: 'small',
    sku: 'small',
    weightGrams: 25,
    price: 10000,
    originalPrice: 10000,
    onSale: false,
    inStock: true,
  },
  {
    id: 'large',
    sku: 'large',
    weightGrams: 100,
    price: 35000,
    originalPrice: 40000,
    onSale: true,
    inStock: false,
  },
];
describe('portion URL and structured data', () => {
  it('selects a known portion even when currently unavailable', () => {
    expect(selectedVariant(variants, '100')?.id).toBe('large');
  });
  it.each([null, undefined, 'invalid', '-25', '9999999', '1e2'])(
    'falls back safely for invalid weight %s',
    (weight) => {
      expect(selectedVariant(variants, weight)?.id).toBe('small');
    },
  );
  it('escapes script terminators in catalog data before embedding JSON-LD', () => {
    const raw = { name: '</script><script>alert(1)</script> ' };
    const escaped = serializeJsonLd(raw);
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain(' ');
    expect(JSON.parse(escaped)).toEqual(raw);
  });
});
