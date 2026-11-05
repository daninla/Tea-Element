import { adjustedStock, validPurchaseDate, validatePurchase } from './inventory-policy';
it('never reduces physical stock below reservations and rejects invalid deltas', () => {
  expect(adjustedStock(100, 40, -60)).toBe(40);
  for (const delta of [-61, 0, 0.5, 2147483647])
    expect(() => adjustedStock(100, 40, delta)).toThrow();
  expect(adjustedStock(100, 40, 25)).toBe(125);
});
it('uses integer cost and positive quantity and rejects future receipts', () => {
  expect(() => validatePurchase(1, 12345)).not.toThrow();
  for (const [qty, cost] of [
    [0, 1],
    [-1, 1],
    [1, 0.5],
    [1, -1],
  ])
    expect(() => validatePurchase(qty!, cost!)).toThrow();
  expect(() =>
    validPurchaseDate('2030-01-01T00:00:00Z', new Date('2026-11-05T00:00:00Z')),
  ).toThrow();
  expect(() => validPurchaseDate('invalid')).toThrow();
});
