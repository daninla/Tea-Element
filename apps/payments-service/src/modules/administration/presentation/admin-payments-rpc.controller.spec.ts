import { randomUUID } from 'node:crypto';
import { AdminPaymentsRpcController } from './admin-payments-rpc.controller';
import type { ReadAdminPayments } from '../application/read-admin-payments';
import type { RequestPaymentReconciliation } from '../application/request-payment-reconciliation';
const context = { userId: randomUUID(), role: 'ADMIN', correlationId: 'admin-payments-test' };
it('rejects customer/forged context and client-supplied amounts or actors', async () => {
  const execute = jest.fn(),
    c = new AdminPaymentsRpcController(
      { execute } as unknown as ReadAdminPayments,
      { execute } as unknown as RequestPaymentReconciliation,
    );
  expect(
    await c.query({ input: { kind: 'LIST', page: 1 }, context: { ...context, role: 'CUSTOMER' } }),
  ).toMatchObject({ ok: false, error: { statusCode: 403 } });
  expect(
    await c.query({
      input: { kind: 'LIST', page: 1 },
      context: { ...context, actorId: randomUUID() },
    }),
  ).toMatchObject({ ok: false, error: { statusCode: 403 } });
  for (const input of [
    {
      paymentId: randomUUID(),
      expectedStatus: 'PENDING',
      reason: 'Check',
      key: randomUUID(),
      amount: 1,
    },
    { paymentId: randomUUID(), expectedStatus: 'PENDING', reason: ' ', key: randomUUID() },
  ])
    expect(await c.request({ input, context })).toMatchObject({
      ok: false,
      error: { statusCode: 400 },
    });
  expect(execute).not.toHaveBeenCalled();
});
it('rejects inverted filters and masks storage errors', async () => {
  const execute = jest.fn().mockRejectedValue(new Error('private')),
    c = new AdminPaymentsRpcController(
      { execute } as unknown as ReadAdminPayments,
      { execute } as unknown as RequestPaymentReconciliation,
    );
  expect(
    await c.query({
      input: { kind: 'LIST', page: 1, from: '2026-11-06T00:00:00Z', to: '2026-11-05T00:00:00Z' },
      context,
    }),
  ).toMatchObject({ ok: false, error: { statusCode: 400 } });
  expect(await c.query({ input: { kind: 'EVENTS', page: 1 }, context })).toEqual({
    ok: false,
    error: {
      code: 'PAYMENTS_UNAVAILABLE',
      message: 'Payment administration unavailable',
      statusCode: 503,
    },
  });
});
