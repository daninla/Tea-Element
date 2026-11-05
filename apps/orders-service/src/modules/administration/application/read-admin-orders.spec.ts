import { ReadAdminOrders } from './read-admin-orders';
import { ReadAdminOrder } from './read-admin-order';
import type { AdminOrdersStore } from '../domain/admin-orders-store';
it('keeps admin filters and propagates unavailable storage without returning partial data', async () => {
  const list = jest.fn().mockRejectedValue(new Error('unavailable'));
  const filters = { page: 2, customerType: 'GUEST' as const, q: 'literal_%' };
  await expect(
    new ReadAdminOrders({ list } as unknown as AdminOrdersStore).execute(filters),
  ).rejects.toThrow('unavailable');
  expect(list).toHaveBeenCalledWith(filters);
});
it('preserves not-found errors for an administrative order detail', async () => {
  const detail = jest.fn().mockRejectedValue(new Error('not found'));
  await expect(
    new ReadAdminOrder({ detail } as unknown as AdminOrdersStore).execute('missing'),
  ).rejects.toThrow('not found');
});
