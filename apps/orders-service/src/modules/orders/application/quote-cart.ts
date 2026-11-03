import { Inject, Injectable } from '@nestjs/common';
import type { CartItemInput } from '@tea/contracts';
import { QuoteProvider } from '../domain/order-store';
@Injectable()
export class QuoteCart {
  constructor(@Inject(QuoteProvider) private readonly catalog: QuoteProvider) {}
  execute(items: CartItemInput[], correlationId: string) {
    return this.catalog.quote(items, correlationId);
  }
}
