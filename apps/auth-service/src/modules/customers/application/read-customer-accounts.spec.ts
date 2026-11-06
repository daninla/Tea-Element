import { ReadCustomerAccounts } from './read-customer-accounts';
import type { CustomerAccountsStore } from '../domain/customer-accounts-store';
it('forwards the trusted actor and preserves unavailable errors', async () => {
  const read = jest.fn().mockRejectedValue(new Error('unavailable')),
    input = { kind: 'LIST', page: 1 } as const;
  await expect(
    new ReadCustomerAccounts({ read } as unknown as CustomerAccountsStore).execute(input, 'actor'),
  ).rejects.toThrow('unavailable');
  expect(read).toHaveBeenCalledWith(input, 'actor');
});
