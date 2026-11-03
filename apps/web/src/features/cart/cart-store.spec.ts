import { addCartItem, storedCart, reconcileCart } from './cart-store';
const id = '00000000-0000-4000-8000-000000000001';
describe('guest cart persistence', () => {
  it('adds and merges the selected portion only', () => {
    expect(addCartItem([{ variantId: id, quantity: 2 }], id, 3)).toEqual([
      { variantId: id, quantity: 5 },
    ]);
  });
  it('caps each portion to the API quantity limit', () => {
    expect(addCartItem([{ variantId: id, quantity: 98 }], id, 4)[0]?.quantity).toBe(99);
  });
  it('preserves the cart instead of exceeding 50 distinct portions', () => {
    const items = Array.from({ length: 50 }, (_, i) => ({ variantId: String(i), quantity: 1 }));
    expect(addCartItem(items, id, 1)).toBe(items);
  });
  it('persists only valid IDs and quantities, never client prices', () => {
    expect(storedCart.safeParse([{ variantId: id, quantity: 1 }]).success).toBe(true);
    expect(storedCart.safeParse([{ variantId: id, quantity: 1, price: 1 }]).success).toBe(false);
  });
  it.each([0, -1, 1.5, 100])('rejects a corrupt cached quantity %s', (quantity) => {
    expect(storedCart.safeParse([{ variantId: id, quantity }]).success).toBe(false);
  });
  it('rejects duplicate cached portions', () => {
    expect(
      storedCart.safeParse([
        { variantId: id, quantity: 1 },
        { variantId: id, quantity: 2 },
      ]).success,
    ).toBe(false);
  });
});

describe('cart edits during session synchronization', () => {
  it('preserves server portions and local quantity edits while login is in flight', () => {
    const before = [{ variantId: id, quantity: 1 }],
      current = [{ variantId: id, quantity: 2 }];
    expect(
      reconcileCart(
        [
          { variantId: id, quantity: 4 },
          { variantId: 'remote', quantity: 1 },
        ],
        before,
        current,
      ),
    ).toEqual([
      { variantId: id, quantity: 5 },
      { variantId: 'remote', quantity: 1 },
    ]);
  });
  it('removes only the local contribution when a portion is deleted during login', () => {
    expect(
      reconcileCart([{ variantId: id, quantity: 4 }], [{ variantId: id, quantity: 1 }], []),
    ).toEqual([{ variantId: id, quantity: 3 }]);
  });
});

it('does not silently discard local additions when remote portions reach the limit', () => {
  const remote = Array.from({ length: 50 }, (_, i) => ({ variantId: String(i), quantity: 1 }));
  expect(() => reconcileCart(remote, [], [{ variantId: id, quantity: 1 }])).toThrow();
});
