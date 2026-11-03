import { effectivePrice, productView } from './pricing';
import { now, product, promotion } from '../../../../test/catalog-fixtures';
describe('catalog pricing and portion availability', () => {
  it('floors the integer percentage discount and never stacks promotions', () => {
    expect(
      effectivePrice(10001, [promotion(), promotion({ type: 'FIXED', value: 2000 })], now),
    ).toBe(8001);
    expect(effectivePrice(10001, [promotion()], now)).toBe(9001);
  });
  it('never produces a negative price and supports 100% promotions', () => {
    expect(effectivePrice(100, [promotion({ type: 'FIXED', value: 999 })], now)).toBe(0);
    expect(effectivePrice(100, [promotion({ value: 100 })], now)).toBe(0);
  });
  it('uses inclusive start and exclusive end, rejecting disabled or invalid discounts', () => {
    expect(effectivePrice(10000, [promotion({ startsAt: now })], now)).toBe(9000);
    for (const p of [
      promotion({ endsAt: now }),
      promotion({ isActive: false }),
      promotion({ startsAt: new Date(now.getTime() + 1) }),
      promotion({ value: -1 }),
      promotion({ value: 101 }),
      promotion({ value: 0.5 }),
    ])
      expect(effectivePrice(10000, [p], now)).toBe(10000);
  });
  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid base price %s', (price) => {
    expect(() => effectivePrice(price, [], now)).toThrow();
  });
  it('shares gram inventory across portions, subtracts reservations and hides inventory internals', () => {
    const view = productView(product, now);
    expect(view.variants.map((v) => v.inStock)).toEqual([true, false]);
    expect(view.inStock).toBe(true);
    expect(view).not.toHaveProperty('inventory');
    expect(productView({ ...product, inventory: null }, now).inStock).toBe(false);
    expect(
      productView({ ...product, inventory: { stockGrams: 10, reservedGrams: 20 } }, now).inStock,
    ).toBe(false);
  });
  it('shows equipment unit prices and piece availability without a brewing guide', () => {
    const view = productView(
      {
        ...product,
        brewingGuide: null,
        category: { ...product.category, section: 'EQUIPMENT' },
        variants: [{ id: 'piece', sku: 'piece', weightGrams: null, price: 89000 }],
        inventory: { stockGrams: 500, reservedGrams: 0, stockPieces: 1, reservedPieces: 1 },
      },
      now,
    );
    expect(view.brewingGuide).toBeNull();
    expect(view.variants[0]?.weightGrams).toBeNull();
    expect(view.inStock).toBe(false);
    expect(view.minPrice).toBe(89000);
  });
});
