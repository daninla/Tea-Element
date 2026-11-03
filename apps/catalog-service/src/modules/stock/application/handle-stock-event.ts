import { Inject, Injectable } from '@nestjs/common';
import type { OrderCreated, OrderCancelled } from '@tea/contracts';
import { StockStore } from '../domain/stock-store';
@Injectable()
export class HandleStockEvent {
  constructor(@Inject(StockStore) private readonly store: StockStore) {}
  execute(event: OrderCreated | OrderCancelled) {
    return this.store.apply(event);
  }
}
