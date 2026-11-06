import { randomUUID } from 'node:crypto';
import { CustomerAccountsRpcController } from './customer-accounts-rpc.controller';
import type { ReadCustomerAccounts } from '../application/read-customer-accounts';
const context = { userId: randomUUID(), role: 'ADMIN', correlationId: 'customer-test' };
it('rejects customer/forged context and malformed filters before reading accounts', async () => {
  const execute = jest.fn(),
    c = new CustomerAccountsRpcController({ execute } as unknown as ReadCustomerAccounts);
  for (const x of [{ ...context, role: 'CUSTOMER' }, { ...context, actorId: randomUUID() }, {}])
    expect(await c.execute({ input: { kind: 'LIST', page: 1 }, context: x })).toMatchObject({
      ok: false,
      error: { statusCode: 403 },
    });
  for (const input of [
    { kind: 'LIST', page: 0 },
    { kind: 'LIST', page: 1, role: 'ADMIN' },
    { kind: 'DETAIL', id: 'invalid' },
  ])
    expect(await c.execute({ input, context })).toMatchObject({
      ok: false,
      error: { statusCode: 400 },
    });
  expect(execute).not.toHaveBeenCalled();
});
it('forwards a valid read and hides storage errors', async () => {
  const execute = jest.fn().mockResolvedValue({ items: [] }),
    c = new CustomerAccountsRpcController({ execute } as unknown as ReadCustomerAccounts);
  expect(await c.execute({ input: { kind: 'LIST', page: 1 }, context })).toMatchObject({
    ok: true,
    value: { items: [] },
  });
  expect(execute).toHaveBeenCalledWith({ kind: 'LIST', page: 1 }, context.userId);
  execute.mockRejectedValue(new Error('private database error'));
  expect(await c.execute({ input: { kind: 'LIST', page: 1 }, context })).toMatchObject({
    ok: false,
    error: { code: 'AUTH_UNAVAILABLE', statusCode: 503 },
  });
});
