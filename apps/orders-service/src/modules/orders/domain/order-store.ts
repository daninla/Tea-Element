import type {
  CartItemInput,
  CartQuote,
  CreateOrderInput,
  CreatedOrder,
  OrderView,
  PaymentOutcome,
  StockReserved,
  StockReservationFailed,
} from '@tea/contracts';
export class OrderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
export interface CreateContext {
  correlationId: string;
  userId?: string;
  idempotencyKey: string;
}
export interface AccessInput {
  number: string;
  token?: string;
  userId?: string;
}
export abstract class OrderStore {
  abstract replay(input: CreateOrderInput, context: CreateContext): Promise<CreatedOrder | null>;
  abstract create(
    input: CreateOrderInput,
    context: CreateContext,
    quote: CartQuote,
  ): Promise<CreatedOrder>;
  abstract get(input: AccessInput): Promise<OrderView>;
  abstract cancel(input: AccessInput, correlationId: string): Promise<OrderView>;
  abstract cart(userId: string): Promise<CartItemInput[]>;
  abstract saveCart(
    userId: string,
    items: CartItemInput[],
    merge: boolean,
    mergeKey?: string,
  ): Promise<CartItemInput[]>;
  abstract handle(event: StockReserved | StockReservationFailed | PaymentOutcome): Promise<void>;
  abstract expire(): Promise<void>;
}
export abstract class QuoteProvider {
  abstract quote(items: CartItemInput[], correlationId: string): Promise<CartQuote>;
}
