import { Inject, Injectable } from '@nestjs/common';
import type { AdminOrderTransition } from '@tea/contracts';
import { AdminOrdersStore } from '../domain/admin-orders-store';
@Injectable()
export class TransitionAdminOrder {
  constructor(@Inject(AdminOrdersStore) private readonly store: AdminOrdersStore) {}
  execute(input: AdminOrderTransition, actorId: string, correlationId: string) {
    return this.store.transition(input, actorId, correlationId);
  }
}
