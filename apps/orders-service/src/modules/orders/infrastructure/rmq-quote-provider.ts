import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import {
  CATALOG_PATTERNS,
  type CartItemInput,
  type CartQuote,
  type CatalogResult,
} from '@tea/contracts';
import { QuoteProvider, OrderError } from '../domain/order-store';
@Injectable()
export class RmqQuoteProvider extends QuoteProvider implements OnModuleDestroy {
  constructor(@Inject('CATALOG_TRANSPORT') private readonly client: ClientProxy) {
    super();
  }
  async quote(items: CartItemInput[], correlationId: string): Promise<CartQuote> {
    try {
      const result = await firstValueFrom(
        this.client
          .send<CatalogResult<CartQuote>>(CATALOG_PATTERNS.quote, {
            input: { items },
            context: { correlationId },
          })
          .pipe(timeout(8000)),
      );
      if (!result.ok) throw new Error();
      return result.value;
    } catch {
      throw new OrderError('CATALOG_UNAVAILABLE', 'Catalog temporarily unavailable', 503);
    }
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}
