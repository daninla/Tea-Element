import { Inject, Injectable } from '@nestjs/common';
import type { CartItemInput } from '@tea/contracts';
import { OrderStore } from '../domain/order-store';
@Injectable()
export class SaveCart {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute(userId: string, items: CartItemInput[]) {
    return this.store.saveCart(userId, items, false);
  }
}
