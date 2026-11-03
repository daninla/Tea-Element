import { Inject, Injectable } from '@nestjs/common';
import type { StockReserved, StockReservationFailed } from '@tea/contracts';
import { OrderStore } from '../domain/order-store';
@Injectable()
export class HandleOrderEvent {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute(event: StockReserved | StockReservationFailed) {
    return this.store.handle(event);
  }
}
