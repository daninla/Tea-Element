import { randomUUID } from 'node:crypto';
import { CustomerOrdersRpcController } from './customer-orders-rpc.controller';
import type { ReadCustomerOrders } from '../application/read-customer-orders';
const context = { userId: randomUUID(), role: 'ADMIN', correlationId: 'customers-test' };
it('rejects unauthorised context and mixed account/email selectors', async () => {
  const execute = jest.fn(),
    c = new CustomerOrdersRpcController({ execute } as unknown as ReadCustomerOrders);
  expect(
    await c.execute({
      input: { kind: 'GUESTS', page: 1 },
      context: { ...context, role: 'CUSTOMER' },
    }),
  ).toMatchObject({ ok: false, error: { statusCode: 403 } });
  for (const customer of [
    { kind: 'ACCOUNT', id: randomUUID(), email: 'x@example.test' },
    { kind: 'GUEST', email: 'x@example.test', id: randomUUID() },
    { kind: 'GUEST', email: 'invalid' },
  ])
    expect(
      await c.execute({ input: { kind: 'HISTORY', customer, page: 1 }, context }),
    ).toMatchObject({ ok: false, error: { statusCode: 400 } });
  expect(execute).not.toHaveBeenCalled();
});
it('normalizes a guest selector and reports unavailable data honestly', async () => {
  const execute = jest.fn().mockResolvedValue({ orders: { items: [] } }),
    c = new CustomerOrdersRpcController({ execute } as unknown as ReadCustomerOrders);
  expect(
    await c.execute({
      input: { kind: 'HISTORY', page: 1, customer: { kind: 'GUEST', email: ' X@Example.test ' } },
      context,
    }),
  ).toMatchObject({ ok: true });
  expect(execute).toHaveBeenCalledWith({
    kind: 'HISTORY',
    page: 1,
    customer: { kind: 'GUEST', email: 'x@example.test' },
  });
  execute.mockRejectedValue(new Error('private error'));
  expect(await c.execute({ input: { kind: 'GUESTS', page: 1 }, context })).toMatchObject({
    ok: false,
    error: { code: 'ORDERS_UNAVAILABLE', statusCode: 503 },
  });
});
