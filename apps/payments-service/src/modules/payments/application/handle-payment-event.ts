import { Inject, Injectable } from '@nestjs/common';
import type { PaymentRequested, OrderCancelled } from '@tea/contracts';
import { PaymentStore } from '../domain/payment-store';
@Injectable()
export class HandlePaymentEvent {
  constructor(@Inject(PaymentStore) private readonly store: PaymentStore) {}
  execute(event: PaymentRequested | OrderCancelled) {
    return event.name === 'PaymentRequested'
      ? this.store.register(event)
      : this.store.cancel(event);
  }
}
