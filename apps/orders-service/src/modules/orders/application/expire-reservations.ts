import { Inject, Injectable } from '@nestjs/common';
import { OrderStore } from '../domain/order-store';
@Injectable()
export class ExpireReservations {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute() {
    return this.store.expire();
  }
}
