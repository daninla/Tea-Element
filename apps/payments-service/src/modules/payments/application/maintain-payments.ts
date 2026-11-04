import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { readEnvironment } from '../../../config/environment';
import { PaymentStore, identity } from '../domain/payment-store';
import { PaymentProvider } from '../domain/payment-provider';
@Injectable()
export class MaintainPayments {
  constructor(
    @Inject(PaymentStore) private readonly store: PaymentStore,
    @Inject(PaymentProvider) private readonly provider: PaymentProvider,
  ) {}
  async execute() {
    // Poll before expiry, so a lost success callback normally wins over the deadline.
    for (const payment of await this.store.due()) {
      if (payment.provider !== readEnvironment().PAYMENT_PROVIDER.toUpperCase()) continue;
      try {
        await this.store.observe(await this.provider.getStatus(identity(payment)), randomUUID());
      } catch {
        /* Provider failures never fabricate a success or cancellation. Deadline policy is independent. */
      }
      await this.store.defer(payment.id);
    }
    await this.store.expire();
    const refund = await this.store.claimRefund();
    if (refund) {
      try {
        const result = await this.provider.refund(identity(refund));
        await this.store.refundResult(refund.id, result.status, randomUUID());
      } catch {
        await this.store.refundResult(refund.id, 'REVIEW_REQUIRED', randomUUID());
      }
    }
  }
}
