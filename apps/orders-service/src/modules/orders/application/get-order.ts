import { Inject, Injectable } from '@nestjs/common';
import { OrderStore, type AccessInput } from '../domain/order-store';
@Injectable()
export class GetOrder {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute(input: AccessInput) {
    return this.store.get(input);
  }
}
