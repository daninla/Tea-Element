import { randomUUID } from 'node:crypto';
import { InventoryRpcController } from './inventory-rpc.controller';
const execute = jest.fn();
const controller = new InventoryRpcController(
  { execute } as never,
  { execute } as never,
  { execute } as never,
  { execute } as never,
  { execute } as never,
);
const context = { userId: randomUUID(), role: 'ADMIN', correlationId: 'test' };
it('rejects an untrusted role before reading or modifying inventory', async () => {
  expect(
    await controller.read({ input: { page: 1 }, context: { ...context, role: 'CUSTOMER' } }),
  ).toMatchObject({ ok: false, error: { statusCode: 403 } });
  expect(await controller.receive({ input: {}, context: {} })).toMatchObject({
    ok: false,
    error: { statusCode: 403 },
  });
  expect(execute).not.toHaveBeenCalled();
});
it('rejects fractional amounts, positive write-offs and injected actors', async () => {
  const purchase = {
    productId: randomUUID(),
    key: randomUUID(),
    quantity: 1,
    purchasePriceTotal: 1.5,
    supplier: 'Demo',
    note: 'Demo receipt',
    purchasedAt: new Date().toISOString(),
  };
  expect(await controller.receive({ input: purchase, context })).toMatchObject({
    ok: false,
    error: { statusCode: 400 },
  });
  expect(
    await controller.change({
      input: {
        productId: purchase.productId,
        key: purchase.key,
        delta: 1,
        expectedStock: 10,
        kind: 'WRITE_OFF',
        reason: 'test',
      },
      context,
    }),
  ).toMatchObject({ ok: false, error: { statusCode: 400 } });
  expect(
    await controller.read({ input: { page: 1, actorId: context.userId }, context }),
  ).toMatchObject({ ok: false, error: { statusCode: 400 } });
  expect(execute).not.toHaveBeenCalled();
});
