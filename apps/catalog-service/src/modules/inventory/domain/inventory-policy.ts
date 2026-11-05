export class InventoryError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'INVENTORY_NOT_FOUND'
      | 'STOCK_CONFLICT'
      | 'INSUFFICIENT_STOCK'
      | 'IDEMPOTENCY_CONFLICT',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
export function adjustedStock(stock: number, reserved: number, delta: number) {
  const next = stock + delta;
  if (
    !Number.isSafeInteger(delta) ||
    delta === 0 ||
    !Number.isSafeInteger(next) ||
    next > 2147483647
  )
    throw new InventoryError('INVALID_INPUT', 'Invalid stock quantity', 400);
  if (next < reserved || next < 0)
    throw new InventoryError(
      'INSUFFICIENT_STOCK',
      'Stock cannot be lower than current reservations',
      409,
    );
  return next;
}
export function validPurchaseDate(value: string, now = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() > now.getTime() + 300000)
    throw new InventoryError('INVALID_INPUT', 'Purchase date cannot be in the future', 400);
  return date;
}

export function validatePurchase(quantity: number, cost: number) {
  if (
    !Number.isSafeInteger(quantity) ||
    quantity <= 0 ||
    quantity > 100000000 ||
    !Number.isSafeInteger(cost) ||
    cost < 0 ||
    cost > 2147483647
  )
    throw new InventoryError('INVALID_INPUT', 'Invalid purchase quantity or cost', 400);
}
