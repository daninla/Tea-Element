import { Inject, Injectable } from '@nestjs/common';
import type { CartItemInput } from '@tea/contracts';
import { StockStore } from '../domain/stock-store';
@Injectable()
export class QuoteCart {
  constructor(@Inject(StockStore) private readonly store: StockStore) {}
  execute(items: CartItemInput[]) {
    return this.store.quote(items);
  }
}
