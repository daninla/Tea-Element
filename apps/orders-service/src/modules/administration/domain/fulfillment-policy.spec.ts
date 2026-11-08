import { canShip, canComplete, canCancel } from './fulfillment-policy';
it('cancels only before shipment and never after a stock deduction', () => {
  const order = {
    status: 'PAID' as const,
    paymentMethod: 'ONLINE_CARD',
    paymentStatus: 'PAID',
    stockDeductedAt: null,
  };
  expect(canCancel(order)).toBe(true);
  for (const status of ['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'] as const)
    expect(canCancel({ ...order, status, paymentStatus: 'UNPAID' })).toBe(true);
  for (const status of ['SHIPPED', 'COMPLETED', 'CANCELLED', 'REJECTED'] as const)
    expect(canCancel({ ...order, status })).toBe(false);
  expect(canCancel({ ...order, stockDeductedAt: new Date() })).toBe(false);
  expect(canCancel({ ...order, paymentStatus: 'REFUNDED' })).toBe(false);
});
it('ships only confirmed COD or paid online orders', () => {
  expect(
    canShip({ status: 'CONFIRMED', paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'UNPAID' }),
  ).toBe(true);
  expect(canShip({ status: 'PAID', paymentMethod: 'ONLINE_CARD', paymentStatus: 'PAID' })).toBe(
    true,
  );
  for (const status of [
    'PENDING',
    'AWAITING_PAYMENT',
    'CANCELLED',
    'COMPLETED',
    'SHIPPED',
  ] as const)
    expect(canShip({ status, paymentMethod: 'ONLINE_CARD', paymentStatus: 'PAID' })).toBe(false);
  expect(canShip({ status: 'PAID', paymentMethod: 'ONLINE_CARD', paymentStatus: 'REFUNDED' })).toBe(
    false,
  );
});
it('requires the warehouse acknowledgement before completion and blocks refunded online orders', () => {
  const order = {
    status: 'SHIPPED' as const,
    paymentMethod: 'ONLINE_CARD',
    paymentStatus: 'PAID',
    stockDeductedAt: new Date(),
  };
  expect(canComplete(order)).toBe(true);
  expect(canComplete({ ...order, stockDeductedAt: null })).toBe(false);
  expect(canComplete({ ...order, paymentStatus: 'REFUNDED' })).toBe(false);
  expect(
    canComplete({ ...order, paymentMethod: 'CASH_ON_DELIVERY', paymentStatus: 'UNPAID' }),
  ).toBe(true);
});
