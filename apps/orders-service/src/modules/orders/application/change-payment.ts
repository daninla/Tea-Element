import { Inject, Injectable } from '@nestjs/common';
import { OrderStore, type AccessInput } from '../domain/order-store';
@Injectable()
export class ChangePayment {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute(input: AccessInput, action: 'RETRY' | 'COD', key: string, correlationId: string) {
    return this.store.changePayment(input, action, key, correlationId);
  }
}
