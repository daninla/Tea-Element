import { ReadAdminPayments } from './read-admin-payments';
import { RequestPaymentReconciliation } from './request-payment-reconciliation';
import type { AdminPaymentsStore } from '../domain/admin-payments-store';
import { canRequestReconciliation } from '../domain/admin-payments-store';
it('forwards payment reads and trusted actor requests without inventing a provider result', async () => {
  const read = jest.fn().mockResolvedValue({ items: [] }),
    reconcile = jest.fn().mockResolvedValue({ status: 'QUEUED' }),
    store = { read, reconcile } as unknown as AdminPaymentsStore;
  await expect(new ReadAdminPayments(store).execute({ kind: 'LIST', page: 1 })).resolves.toEqual({
    items: [],
  });
  const input = {
    paymentId: 'id',
    expectedStatus: 'PENDING',
    reason: 'Check',
    key: 'key',
  } as const;
  await expect(new RequestPaymentReconciliation(store).execute(input, 'actor')).resolves.toEqual({
    status: 'QUEUED',
  });
  expect(reconcile).toHaveBeenCalledWith(input, 'actor');
  read.mockRejectedValue(new Error('unavailable'));
  await expect(new ReadAdminPayments(store).execute({ kind: 'DETAIL', id: 'id' })).rejects.toThrow(
    'unavailable',
  );
});
it('does not schedule terminal refund states', () => {
  for (const s of ['CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'])
    expect(canRequestReconciliation(s)).toBe(true);
  for (const s of ['REFUNDED', 'PARTIALLY_REFUNDED', 'invalid'])
    expect(canRequestReconciliation(s)).toBe(false);
});
