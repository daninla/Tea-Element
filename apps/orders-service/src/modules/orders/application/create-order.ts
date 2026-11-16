import { Inject, Injectable, Optional } from '@nestjs/common';
import type { CreateOrderInput } from '@tea/contracts';
import { OrderError, OrderStore, QuoteProvider, type CreateContext } from '../domain/order-store';
import { CheckoutDelivery } from './checkout-delivery';
import { validateOrderQuote } from '../domain/order-policy';
@Injectable()
export class CreateOrder {
  constructor(
    @Inject(OrderStore) private readonly store: OrderStore,
    @Inject(QuoteProvider) private readonly catalog: QuoteProvider,
    @Optional() @Inject(CheckoutDelivery) private readonly delivery?: CheckoutDelivery,
  ) {}
  async execute(input: CreateOrderInput, context: CreateContext) {
    const existing = await this.store.replay(input, context);
    if (existing) return existing;
    if (input.delivery.method === 'PICKUP')
      throw new OrderError('DELIVERY_METHOD_UNAVAILABLE', 'Pickup is unavailable', 400);
    const quote = await this.catalog.quote(input.items, context.correlationId);
    validateOrderQuote(quote, input.items);
    if (input.paymentMethod === 'ONLINE_CARD' && quote.total < 1)
      throw new OrderError('INVALID_TOTAL', 'Online payment requires a positive total', 400);
    if (input.delivery.method === 'CARRIER_POINT') {
      if (!this.delivery || !input.delivery.selection)
        throw new OrderError('INVALID_DELIVERY_POINT', 'Select a delivery point', 400);
      const rate = await this.delivery.rate(input.delivery.selection, quote, input.paymentMethod);
      if (input.expectedDeliveryTotal !== quote.total + rate.fee)
        throw new OrderError('DELIVERY_PRICE_CHANGED', 'Delivery total changed', 409);
      return this.store.create(input, context, quote, rate);
    }
    return this.store.create(input, context, quote);
  }
}
