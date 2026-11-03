export function variantStock(
  weightGrams: number | null,
  section = 'TEA',
): { unit: 'GRAM' | 'PIECE'; amount: number } {
  if (section === 'EQUIPMENT' && weightGrams === null) return { unit: 'PIECE', amount: 1 };
  if (
    section === 'TEA' &&
    weightGrams !== null &&
    Number.isSafeInteger(weightGrams) &&
    weightGrams > 0
  )
    return { unit: 'GRAM', amount: weightGrams };
  throw new Error('Variant stock unit does not match its category');
}
export function availableStock(
  inventory: {
    stockGrams: number;
    reservedGrams: number;
    stockPieces?: number;
    reservedPieces?: number;
  } | null,
  unit: 'GRAM' | 'PIECE',
) {
  return Math.max(
    0,
    unit === 'GRAM'
      ? (inventory?.stockGrams ?? 0) - (inventory?.reservedGrams ?? 0)
      : (inventory?.stockPieces ?? 0) - (inventory?.reservedPieces ?? 0),
  );
}
