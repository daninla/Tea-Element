import { TransitionAdminOrder } from './transition-admin-order';
import type { AdminOrdersStore } from '../domain/admin-orders-store';
it('passes the trusted actor and propagates atomic-transition failure', async () => {
  const transition = jest.fn().mockRejectedValue(new Error('conflict'));
  const input = {
    id: 'order',
    status: 'SHIPPED' as const,
    expectedStatus: 'CONFIRMED' as const,
    reason: 'test',
    key: 'command',
  };
  await expect(
    new TransitionAdminOrder({ transition } as unknown as AdminOrdersStore).execute(
      input,
      'trusted-actor',
      'correlation',
    ),
  ).rejects.toThrow('conflict');
  expect(transition).toHaveBeenCalledWith(input, 'trusted-actor', 'correlation');
});
