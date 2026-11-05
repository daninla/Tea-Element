import type {
  StockMovementPage,
  CartItemInput,
  CartQuote,
  OrderCreated,
  OrderCreatedV2,
  OrderCancelled,
  OrderShipped,
} from '@tea/contracts';
export abstract class StockStore {
  abstract movements(orderId: string, page: number): Promise<StockMovementPage>;
  abstract quote(items: CartItemInput[]): Promise<CartQuote>;
  abstract apply(
    event: OrderCreated | OrderCreatedV2 | OrderCancelled | OrderShipped,
  ): Promise<void>;
}
