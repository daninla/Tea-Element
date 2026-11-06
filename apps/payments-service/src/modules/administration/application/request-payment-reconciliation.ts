import { Inject, Injectable } from '@nestjs/common';
import type { AdminReconciliation } from '@tea/contracts';
import { AdminPaymentsStore } from '../domain/admin-payments-store';
@Injectable()
export class RequestPaymentReconciliation {
  constructor(@Inject(AdminPaymentsStore) private readonly store: AdminPaymentsStore) {}
  execute(input: AdminReconciliation, actorId: string) {
    return this.store.reconcile(input, actorId);
  }
}
