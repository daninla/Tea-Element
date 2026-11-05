import { Inject, Injectable } from '@nestjs/common';
import { StockStore } from '../domain/stock-store';
@Injectable()
export class ReadStockMovements {
  constructor(@Inject(StockStore) private readonly store: StockStore) {}
  execute(orderId: string, page: number) {
    return this.store.movements(orderId, page);
  }
}
