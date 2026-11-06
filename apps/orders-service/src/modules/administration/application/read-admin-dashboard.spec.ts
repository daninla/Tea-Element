import { ReadAdminDashboard } from './read-admin-dashboard';
import type { AdminDashboardStore } from '../domain/admin-dashboard-store';
it('uses the server clock and forwards the bounded report period', async () => {
  const now = new Date('2026-11-06T12:00:00Z');
  jest.useFakeTimers().setSystemTime(now);
  const read = jest.fn().mockResolvedValue({ days: 7 });
  try {
    await expect(
      new ReadAdminDashboard({ read } as unknown as AdminDashboardStore).execute(7),
    ).resolves.toEqual({ days: 7 });
    expect(read).toHaveBeenCalledWith(7, now);
  } finally {
    jest.useRealTimers();
  }
});
it('propagates unavailable storage instead of returning zero sales', async () => {
  const read = jest.fn().mockRejectedValue(new Error('unavailable'));
  await expect(
    new ReadAdminDashboard({ read } as unknown as AdminDashboardStore).execute(1),
  ).rejects.toThrow('unavailable');
});
