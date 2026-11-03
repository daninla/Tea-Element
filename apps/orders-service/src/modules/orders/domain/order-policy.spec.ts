import { mergeCartItems, reservationStatus, validateOrderQuote } from './order-policy';
import type { CartQuote } from '@tea/contracts';
describe('order policy', () => {
  it.each(['CONFIRMED', 'REJECTED', 'CANCELLED', 'SHIPPED', 'COMPLETED'] as const)(
    'does not revive a %s order',
    (status) => {
      expect(reservationStatus(status, 'StockReserved')).toBe(status);
    },
  );
  it('accepts or rejects a pending reservation', () => {
    expect(reservationStatus('PENDING', 'StockReserved')).toBe('CONFIRMED');
    expect(reservationStatus('PENDING', 'StockReservationFailed')).toBe('REJECTED');
  });
  it('merges distinct portions and bounds quantities', () => {
    expect(
      mergeCartItems(
        [{ variantId: 'a', quantity: 98 }],
        [
          { variantId: 'a', quantity: 3 },
          { variantId: 'b', quantity: 2 },
        ],
      ),
    ).toEqual([
      { variantId: 'a', quantity: 99 },
      { variantId: 'b', quantity: 2 },
    ]);
  });
  it('rejects a cart over the bounded line limit', () => {
    expect(() =>
      mergeCartItems(
        Array.from({ length: 50 }, (_, i) => ({ variantId: String(i), quantity: 1 })),
        [{ variantId: 'new', quantity: 1 }],
      ),
    ).toThrow();
  });
  it('rejects unavailable portions before creating an order', () => {
    expect(() =>
      validateOrderQuote(
        { items: [], unavailableVariantIds: ['missing'], subtotal: 0, discount: 0, total: 0 },
        [{ variantId: 'missing', quantity: 1 }],
      ),
    ).toThrow();
  });
  it('rejects invalid totals', () => {
    const quote = {
      items: [{ inStock: true }],
      unavailableVariantIds: [],
      total: Infinity,
    } as unknown as CartQuote;
    expect(() => validateOrderQuote(quote, [{ variantId: 'a', quantity: 1 }])).toThrow();
  });
});
