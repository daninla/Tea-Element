import type { CartItemInput, CartQuote, OrderStatus } from '@tea/contracts';
import { OrderError } from './order-store';
export function validateOrderQuote(quote: CartQuote, items: CartItemInput[]) {
  if (quote.unavailableVariantIds.length || quote.items.length !== items.length)
    throw new OrderError('INVALID_ITEMS', 'Some portions are unavailable', 409);
  if (quote.items.some((x) => !x.inStock))
    throw new OrderError('INSUFFICIENT_STOCK', 'Not enough tea available', 409);
  if (!Number.isSafeInteger(quote.total) || quote.total < 0 || quote.total > 2147483647)
    throw new OrderError('INVALID_TOTAL', 'Invalid order total', 400);
}
export function reservationStatus(
  current: OrderStatus,
  event: 'StockReserved' | 'StockReservationFailed',
  method: 'CASH_ON_DELIVERY' | 'ONLINE_CARD' = 'CASH_ON_DELIVERY',
): OrderStatus {
  return current === 'PENDING'
    ? event === 'StockReserved'
      ? method === 'ONLINE_CARD'
        ? 'AWAITING_PAYMENT'
        : 'CONFIRMED'
      : 'REJECTED'
    : current;
}
export function mergeCartItems(
  current: CartItemInput[],
  incoming: CartItemInput[],
): CartItemInput[] {
  const quantities = new Map(current.map((x) => [x.variantId, x.quantity]));
  for (const x of incoming)
    quantities.set(x.variantId, Math.min(99, (quantities.get(x.variantId) ?? 0) + x.quantity));
  if (quantities.size > 50) throw new OrderError('CART_LIMIT', 'Cart has too many portions', 400);
  return [...quantities].map(([variantId, quantity]) => ({ variantId, quantity }));
}
