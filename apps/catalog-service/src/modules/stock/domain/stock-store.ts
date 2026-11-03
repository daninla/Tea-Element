import type { CartItemInput, CartQuote, OrderCreated, OrderCancelled } from '@tea/contracts';
export abstract class StockStore {
  abstract quote(items: CartItemInput[]): Promise<CartQuote>;
  abstract apply(event: OrderCreated | OrderCancelled): Promise<void>;
}
