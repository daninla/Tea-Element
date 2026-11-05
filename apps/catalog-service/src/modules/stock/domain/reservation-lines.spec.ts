import { reservationLines } from './reservation-lines';
it('supports legacy gram reservations and mixed units in stable product order', () => {
  expect(
    reservationLines([
      { productId: 'b', grams: 50 },
      { productId: 'a', unit: 'PIECE', amount: 2 },
    ]),
  ).toEqual([
    { productId: 'a', unit: 'PIECE', amount: 2 },
    { productId: 'b', unit: 'GRAM', amount: 50 },
  ]);
});
it('refuses corrupt data instead of decrementing arbitrary or negative inventory', () => {
  for (const value of [
    [],
    [{ productId: 'a', grams: -2 }],
    [{ productId: 'a', unit: 'OTHER', amount: 1 }],
    [
      { productId: 'a', grams: 1 },
      { productId: 'a', grams: 2 },
    ],
  ])
    expect(() => reservationLines(value)).toThrow();
});
