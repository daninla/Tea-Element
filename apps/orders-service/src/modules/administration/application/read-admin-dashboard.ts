import { Inject, Injectable } from '@nestjs/common';
import type { DashboardDays } from '@tea/contracts';
import { AdminDashboardStore } from '../domain/admin-dashboard-store';
@Injectable()
export class ReadAdminDashboard {
  constructor(@Inject(AdminDashboardStore) private readonly store: AdminDashboardStore) {}
  execute(days: DashboardDays) {
    return this.store.read(days, new Date());
  }
}
