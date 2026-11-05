import type { OrderStatus } from '@tea/contracts';
export function canShip(order: {
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
}) {
  return (
    (order.paymentMethod === 'CASH_ON_DELIVERY' &&
      order.status === 'CONFIRMED' &&
      order.paymentStatus === 'UNPAID') ||
    (order.paymentMethod === 'ONLINE_CARD' &&
      order.status === 'PAID' &&
      order.paymentStatus === 'PAID')
  );
}
export function canComplete(order: {
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  stockDeductedAt: Date | null;
}) {
  return (
    order.status === 'SHIPPED' &&
    !!order.stockDeductedAt &&
    (order.paymentMethod === 'CASH_ON_DELIVERY'
      ? ['UNPAID', 'PAID'].includes(order.paymentStatus)
      : order.paymentStatus === 'PAID')
  );
}
