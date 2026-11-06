import { ReadCustomerOrders } from './read-customer-orders';
import type { CustomerOrdersStore } from '../domain/customer-orders-store';
it('preserves the exact account/guest scope and never invents empty history on failure', async () => {
  const read = jest.fn().mockResolvedValue({ orders: { items: [] } }),
    u = new ReadCustomerOrders({ read } as unknown as CustomerOrdersStore),
    input = { kind: 'HISTORY', page: 2, customer: { kind: 'ACCOUNT', id: 'account' } } as const;
  await expect(u.execute(input)).resolves.toEqual({ orders: { items: [] } });
  expect(read).toHaveBeenCalledWith(input);
  read.mockRejectedValue(new Error('unavailable'));
  await expect(u.execute({ kind: 'GUESTS', page: 1 })).rejects.toThrow('unavailable');
});
