import { Inject, Injectable } from '@nestjs/common';
import { OrderStore, type AccessInput } from '../domain/order-store';
@Injectable()
export class CancelOrder {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute(input: AccessInput, correlationId: string) {
    return this.store.cancel(input, correlationId);
  }
}
