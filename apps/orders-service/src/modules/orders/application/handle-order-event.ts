import { Inject, Injectable } from '@nestjs/common';
import type {
  PaymentOutcome,
  StockReserved,
  StockDeducted,
  StockReservationFailed,
} from '@tea/contracts';
import { OrderStore } from '../domain/order-store';
@Injectable()
export class HandleOrderEvent {
  constructor(@Inject(OrderStore) private readonly store: OrderStore) {}
  execute(event: StockReserved | StockReservationFailed | StockDeducted | PaymentOutcome) {
    return this.store.handle(event);
  }
}
