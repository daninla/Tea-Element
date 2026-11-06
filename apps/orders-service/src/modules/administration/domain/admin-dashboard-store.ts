import type { AdminDashboard, DashboardDays } from '@tea/contracts';
export abstract class AdminDashboardStore {
  abstract read(days: DashboardDays, asOf: Date): Promise<AdminDashboard>;
}
export function reportNumber(value: bigint | number) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Invalid report aggregate');
  return n;
}
