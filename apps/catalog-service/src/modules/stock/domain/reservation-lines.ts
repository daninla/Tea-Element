export interface ReservationLine {
  productId: string;
  unit: 'GRAM' | 'PIECE';
  amount: number;
}
export function reservationLines(value: unknown): ReservationLine[] {
  if (!Array.isArray(value) || !value.length) throw new Error('Invalid stored reservation');
  const result = value
    .map((x: { productId?: unknown; unit?: unknown; amount?: unknown; grams?: unknown }) => {
      const unit = x.unit ?? 'GRAM',
        amount = x.amount ?? x.grams;
      if (
        typeof x.productId !== 'string' ||
        !['GRAM', 'PIECE'].includes(String(unit)) ||
        typeof amount !== 'number' ||
        !Number.isSafeInteger(amount) ||
        amount <= 0
      )
        throw new Error('Invalid stored reservation');
      return { productId: x.productId, unit: unit as 'GRAM' | 'PIECE', amount };
    })
    .sort((a, b) => a.productId.localeCompare(b.productId));
  if (new Set(result.map((x) => x.productId)).size !== result.length)
    throw new Error('Duplicate reservation product');
  return result;
}
