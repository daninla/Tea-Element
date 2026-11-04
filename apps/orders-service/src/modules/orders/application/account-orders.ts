import { Inject, Injectable } from '@nestjs/common';
import { OrderStore } from '../domain/order-store';
import type { UserEmailVerified } from '@tea/contracts';
@Injectable()
export class AccountOrders {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  async execute(
    input:
      | { action: 'LIST'; userId: string; page: number }
      | { action: 'LOOKUP'; number: string; email: string }
      | { action: 'VERIFY'; event: UserEmailVerified }
      | { action: 'RECONCILE' },
  ) {
    if (input.action === 'LIST') return this.store.list(input.userId, input.page);
    if (input.action === 'LOOKUP') return this.store.lookup(input.number, input.email);
    if (input.action === 'VERIFY') return this.store.linkVerified(input.event);
    return this.store.reconcileVerified();
  }
}
