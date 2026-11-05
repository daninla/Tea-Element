import type { AdminOrderFilters, AdminOrderPage, AdminOrderDetail } from '@tea/contracts';
export abstract class AdminOrdersStore {
  abstract list(filters: AdminOrderFilters): Promise<AdminOrderPage>;
  abstract detail(id: string): Promise<AdminOrderDetail>;
}
