import type {
  CartItemInput,
  CartQuote,
  OrderCreated,
  OrderCreatedV2,
  OrderCancelled,
} from '@tea/contracts';
export abstract class StockStore {
  abstract quote(items: CartItemInput[]): Promise<CartQuote>;
  abstract apply(event: OrderCreated | OrderCreatedV2 | OrderCancelled): Promise<void>;
}
