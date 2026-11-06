import { Inject, Injectable } from '@nestjs/common';
import type { AdminPaymentsRead } from '@tea/contracts';
import { AdminPaymentsStore } from '../domain/admin-payments-store';
@Injectable()
export class ReadAdminPayments {
  constructor(@Inject(AdminPaymentsStore) private readonly store: AdminPaymentsStore) {}
  execute(input: AdminPaymentsRead) {
    return this.store.read(input);
  }
}
