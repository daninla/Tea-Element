import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  CATALOG_MARKETING_PROMOTIONS_PATTERN,
  type OrdersResult,
  type MarketingPromotionPage,
} from '@tea/contracts';
import { PromotionSource } from '../domain/campaign-store';
const schema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            title: z.string().min(1).max(200),
            active: z.boolean(),
            startsAt: z.string().datetime(),
            endsAt: z.string().datetime(),
            revision: z.number().int().min(0),
          })
          .strict()
          .refine((x) => Date.parse(x.startsAt) < Date.parse(x.endsAt)),
      )
      .max(100),
    nextCursor: z.string().uuid().nullable(),
  })
  .strict();
@Injectable()
export class RmqPromotionSource extends PromotionSource implements OnModuleDestroy {
  constructor(@Inject('CATALOG_MARKETING_TRANSPORT') private readonly client: ClientProxy) {
    super();
  }
  async list(after?: string): Promise<MarketingPromotionPage> {
    const result = await firstValueFrom(
      this.client
        .send<OrdersResult<MarketingPromotionPage>>(CATALOG_MARKETING_PROMOTIONS_PATTERN, {
          input: { ...(after ? { after } : {}) },
          context: { correlationId: randomUUID() },
        })
        .pipe(timeout(5000)),
    );
    if (!result.ok) throw new Error('CATALOG_UNAVAILABLE');
    return schema.parse(result.value);
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}
