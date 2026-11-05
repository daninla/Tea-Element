import { Inject, Injectable } from '@nestjs/common';
import { AdminOrdersStore } from '../domain/admin-orders-store';
@Injectable()
export class ReadAdminOrder {
  constructor(@Inject(AdminOrdersStore) private readonly store: AdminOrdersStore) {}
  execute(id: string) {
    return this.store.detail(id);
  }
}
