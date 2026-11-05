import { AdminStockRpcController } from './admin-stock-rpc.controller';
import { ReadStockMovements } from '../application/read-stock-movements';
import { randomUUID } from 'node:crypto';
it('rejects untrusted roles and unbounded journal reads', async () => {
  const execute = jest.fn();
  const controller = new AdminStockRpcController({ execute } as unknown as ReadStockMovements);
  const context = { correlationId: 'test', userId: randomUUID(), role: 'CUSTOMER' };
  expect(
    await controller.movements({ input: { orderId: randomUUID(), page: 1 }, context }),
  ).toMatchObject({ ok: false, error: { statusCode: 403 } });
  expect(
    await controller.movements({
      input: { orderId: randomUUID(), page: 10001 },
      context: { ...context, role: 'ADMIN' },
    }),
  ).toMatchObject({ ok: false, error: { statusCode: 400 } });
  expect(execute).not.toHaveBeenCalled();
});
