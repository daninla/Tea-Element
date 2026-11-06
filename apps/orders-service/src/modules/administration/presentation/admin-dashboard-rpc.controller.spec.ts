import { randomUUID } from 'node:crypto';
import { AdminDashboardRpcController } from './admin-dashboard-rpc.controller';
import type { ReadAdminDashboard } from '../application/read-admin-dashboard';
import { reportNumber } from '../domain/admin-dashboard-store';
const context = { userId: randomUUID(), role: 'ADMIN', correlationId: 'report-test' };
it('rejects missing/customer/forged context before reading data', async () => {
  const execute = jest.fn();
  const c = new AdminDashboardRpcController({ execute } as unknown as ReadAdminDashboard);
  for (const x of [{}, { ...context, role: 'CUSTOMER' }, { ...context, actorId: randomUUID() }])
    expect(await c.execute({ input: { days: 7 }, context: x })).toMatchObject({
      ok: false,
      error: { statusCode: 403 },
    });
  expect(execute).not.toHaveBeenCalled();
});
it('validates the period and maps a storage error to unavailable', async () => {
  const execute = jest.fn().mockRejectedValue(new Error('private error'));
  const c = new AdminDashboardRpcController({ execute } as unknown as ReadAdminDashboard);
  for (const input of [{ days: 2 }, { days: 30, userId: randomUUID() }, { days: '7' }])
    expect(await c.execute({ input, context })).toMatchObject({
      ok: false,
      error: { statusCode: 400 },
    });
  expect(await c.execute({ input: { days: 30 }, context })).toEqual({
    ok: false,
    error: { code: 'ORDERS_UNAVAILABLE', message: 'Report unavailable', statusCode: 503 },
  });
  execute.mockResolvedValue({ days: 7 });
  expect(await c.execute({ input: { days: 7 }, context })).toEqual({
    ok: true,
    value: { days: 7 },
  });
});
it('rejects negative or imprecise aggregate values', () => {
  expect(reportNumber(10001n)).toBe(10001);
  for (const x of [-1, Number.NaN, 9007199254740992n]) expect(() => reportNumber(x)).toThrow();
});
