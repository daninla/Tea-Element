import { Inject, Injectable } from '@nestjs/common';
import { OrderStore } from '../domain/order-store';
@Injectable()
export class ReadCart {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute(userId: string) {
    return this.store.cart(userId);
  }
}
