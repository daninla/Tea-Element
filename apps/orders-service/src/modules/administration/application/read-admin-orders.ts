import { Inject, Injectable } from '@nestjs/common';
import type { AdminOrderFilters } from '@tea/contracts';
import { AdminOrdersStore } from '../domain/admin-orders-store';
@Injectable()
export class ReadAdminOrders {
  constructor(@Inject(AdminOrdersStore) private readonly store: AdminOrdersStore) {}
  execute(filters: AdminOrderFilters) {
    return this.store.list(filters);
  }
}
