import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { z } from 'zod';
import { readEnvironment } from '../../../config/environment';
import { RabbitEventBus } from '../../../shared/rabbit-event-bus';
import { HandleMarketingEvent } from '../application/handle-marketing-event';
import { RunCampaigns } from '../application/run-campaigns';
import { SyncPromotions } from '../application/sync-promotions';
const base = {
  eventId: z.string().uuid(),
  version: z.literal(1),
  occurredAt: z.string().datetime(),
  correlationId: z.string().min(1).max(100),
};
export const marketingEventSchema = z
  .discriminatedUnion('name', [
    z
      .object({
        ...base,
        name: z.literal('UserRegistered'),
        payload: z
          .object({
            userId: z.string().uuid(),
            email: z.string().email().max(320),
            firstName: z.string().min(1).max(100),
            lastName: z.string().max(100),
            marketingConsent: z.boolean(),
          })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...base,
        name: z.literal('OrderCompleted'),
        payload: z
          .object({
            orderId: z.string().uuid(),
            userId: z.string().uuid().nullable(),
            email: z.string().email().max(320),
            firstName: z.string().min(1).max(100),
            lastName: z.string().max(100),
            marketingConsent: z.boolean(),
            marketingConsentAt: z.string().datetime().optional(),
            total: z.number().int().min(1).max(2147483647),
            items: z
              .array(
                z
                  .object({
                    productId: z.string().uuid(),
                    quantity: z.number().int().min(1).max(99),
                  })
                  .strict(),
              )
              .min(1)
              .max(50),
          })
          .strict(),
      })
      .strict(),
  ])
  .refine(
    (e) =>
      Date.parse(e.occurredAt) <= Date.now() + 300000 &&
      (e.name !== 'OrderCompleted' ||
        !e.payload.marketingConsentAt ||
        Date.parse(e.payload.marketingConsentAt) <= Date.parse(e.occurredAt)),
  );
@Injectable()
export class MarketingWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private nextRun = 0;
  constructor(
    @Inject(RabbitEventBus) private readonly bus: RabbitEventBus,
    @Inject(HandleMarketingEvent) private readonly handler: HandleMarketingEvent,
    @Inject(RunCampaigns) private readonly campaigns: RunCampaigns,
    @Inject(SyncPromotions) private readonly promotions: SyncPromotions,
  ) {}
  onModuleInit() {
    if (readEnvironment().NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.run()
          .catch(() => {})
          .finally(() => {
            this.active = undefined;
          });
    }, 1000);
    this.timer.unref();
  }
  private async run() {
    for (const queue of ['marketing.user_registered', 'marketing.order_completed'])
      await this.bus.subscribe(queue, (raw) =>
        this.handler.execute(marketingEventSchema.parse(raw)),
      );
    if (Date.now() >= this.nextRun) {
      this.nextRun = Date.now() + 60000;
      await this.promotions.execute();
      await this.campaigns.execute();
    }
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
