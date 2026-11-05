import { randomUUID } from 'node:crypto';
import { AdminOrdersRpcController } from './admin-orders-rpc.controller';
import { ReadAdminOrders } from '../application/read-admin-orders';
import { ReadAdminOrder } from '../application/read-admin-order';
const list = jest.fn(),
  detail = jest.fn();
const controller = new AdminOrdersRpcController(
  { execute: jest.fn() } as never,
  { execute: list } as unknown as ReadAdminOrders,
  { execute: detail } as unknown as ReadAdminOrder,
);
const context = { userId: randomUUID(), role: 'ADMIN', correlationId: 'test' };
it('rejects missing or customer role before executing the read', async () => {
  for (const invalid of [
    { ...context, role: 'CUSTOMER' },
    { userId: context.userId, correlationId: 'test' },
    {},
  ]) {
    expect(await controller.read({ input: { page: 1 }, context: invalid })).toMatchObject({
      ok: false,
      error: { statusCode: 403 },
    });
  }
  expect(list).not.toHaveBeenCalled();
});
it('rejects unbounded pages, invalid date order and extra input fields', async () => {
  for (const input of [
    { page: 0 },
    { page: 10001 },
    { page: 1, from: '2026-11-05T00:00:00Z', to: '2026-11-04T00:00:00Z' },
    { page: 1, userId: randomUUID() },
  ])
    expect(await controller.read({ input, context })).toMatchObject({
      ok: false,
      error: { statusCode: 400 },
    });
  expect(list).not.toHaveBeenCalled();
});
it('does not expose raw database errors', async () => {
  detail.mockRejectedValueOnce(new Error('database secret'));
  const result = await controller.get({ input: { id: randomUUID() }, context });
  expect(result).toMatchObject({ ok: false, error: { statusCode: 503 } });
  expect(JSON.stringify(result)).not.toContain('database secret');
});
