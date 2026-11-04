import { Inject, Injectable } from '@nestjs/common';
import type { CreateOrderInput } from '@tea/contracts';
import { OrderError, OrderStore, QuoteProvider, type CreateContext } from '../domain/order-store';
import { validateOrderQuote } from '../domain/order-policy';
@Injectable()
export class CreateOrder {
  constructor(
    @Inject(OrderStore) private readonly store: OrderStore,
    @Inject(QuoteProvider) private readonly catalog: QuoteProvider,
  ) {}
  async execute(input: CreateOrderInput, context: CreateContext) {
    const existing = await this.store.replay(input, context);
    if (existing) return existing;
    const quote = await this.catalog.quote(input.items, context.correlationId);
    validateOrderQuote(quote, input.items);
    if (input.paymentMethod === 'ONLINE_CARD' && quote.total < 1)
      throw new OrderError('INVALID_TOTAL', 'Online payment requires a positive total', 400);
    return this.store.create(input, context, quote);
  }
}
