import { Inject, Injectable } from '@nestjs/common';
import type { OrderCreated, OrderCreatedV2, OrderCancelled, OrderShipped } from '@tea/contracts';
import { StockStore } from '../domain/stock-store';
@Injectable()
export class HandleStockEvent {
  constructor(@Inject(StockStore) private readonly store: StockStore) {}
  execute(event: OrderCreated | OrderCreatedV2 | OrderCancelled | OrderShipped) {
    return this.store.apply(event);
  }
}
