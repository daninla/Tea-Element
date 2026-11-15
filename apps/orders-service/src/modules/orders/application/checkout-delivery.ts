import { Inject, Injectable } from '@nestjs/common';
import type {
  CartQuote,
  CreateOrderInput,
  DeliveryRequest,
  DeliverySelection,
} from '@tea/contracts';
import { DeliveryProvider } from '../domain/delivery-provider';
import { OrderError, QuoteProvider } from '../domain/order-store';
import { validateOrderQuote } from '../domain/order-policy';

function positiveInteger(value: string | undefined, max: number) {
  if (!value || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max)
    throw new OrderError('DELIVERY_PACKAGING_REQUIRED', 'Parcel configuration unavailable', 503);
  return Number(value);
}

@Injectable()
export class CheckoutDelivery {
  constructor(
    @Inject(DeliveryProvider) private readonly provider: DeliveryProvider,
    @Inject(QuoteProvider) private readonly catalog: QuoteProvider,
  ) {}
  async execute(input: DeliveryRequest, correlationId: string) {
    switch (input.kind) {
      case 'CARRIERS':
        return this.provider.available();
      case 'REGIONS':
        return this.provider.regions();
      case 'CITIES':
        return this.provider.cities(input.carrier, input.query, input.regionId);
      case 'POINTS':
        return this.provider.points(input.carrier, input.cityId, input.query);
      case 'QUOTE': {
        const quote = await this.catalog.quote(input.items, correlationId);
        validateOrderQuote(quote, input.items);
        const { fee } = await this.rate(input.selection, quote, input.paymentMethod);
        return { fee, total: quote.total + fee };
      }
    }
  }

  async rate(
    selection: DeliverySelection,
    quote: CartQuote,
    paymentMethod: CreateOrderInput['paymentMethod'],
  ) {
    const env = process.env;
    const weight = quote.items.reduce(
      (sum, item) =>
        sum +
        item.quantity * (item.weightGrams ?? positiveInteger(env.DELIVERY_PIECE_GRAMS, 20_000)),
      positiveInteger(env.DELIVERY_PACKAGING_GRAMS, 10_000),
    );
    if (weight > positiveInteger(env.DELIVERY_BOX_MAX_GRAMS, 30_000))
      throw new OrderError('DELIVERY_PARCEL_TOO_HEAVY', 'Choose another delivery method', 400);
    const rate = await this.provider.rate(selection, {
      weight,
      length: positiveInteger(env.DELIVERY_BOX_LENGTH_CM, 120),
      width: positiveInteger(env.DELIVERY_BOX_WIDTH_CM, 120),
      height: positiveInteger(env.DELIVERY_BOX_HEIGHT_CM, 120),
      value: quote.total,
      cod: paymentMethod === 'CASH_ON_DELIVERY',
    });
    if (!Number.isSafeInteger(rate.fee) || rate.fee < 0 || rate.fee + quote.total > 2147483647)
      throw new OrderError('DELIVERY_UNAVAILABLE', 'Invalid delivery tariff', 503);
    return rate;
  }
}
