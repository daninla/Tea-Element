import { variantStock, availableStock } from './inventory-unit';
describe('inventory units', () => {
  it('consumes the actual gram weight for tea', () =>
    expect(variantStock(50, 'TEA')).toEqual({ unit: 'GRAM', amount: 50 }));
  it('consumes one piece for equipment without assigning a gram weight', () =>
    expect(variantStock(null, 'EQUIPMENT')).toEqual({ unit: 'PIECE', amount: 1 }));
  it.each([
    [25, 'EQUIPMENT'],
    [null, 'TEA'],
    [0, 'TEA'],
    [-25, 'TEA'],
  ])('rejects a variant whose weight does not match its section', (weight, section) =>
    expect(() => variantStock(weight as number | null, section as string)).toThrow(),
  );
  it('never counts tea grams as equipment pieces', () =>
    expect(
      availableStock(
        { stockGrams: 500, reservedGrams: 0, stockPieces: 3, reservedPieces: 2 },
        'PIECE',
      ),
    ).toBe(1));
  it('bounds missing or over-reserved inventory to zero', () => {
    expect(availableStock(null, 'PIECE')).toBe(0);
    expect(
      availableStock(
        { stockGrams: 0, reservedGrams: 0, stockPieces: 1, reservedPieces: 2 },
        'PIECE',
      ),
    ).toBe(0);
  });
});
