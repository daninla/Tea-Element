import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { z } from 'zod';
import { RabbitEventBus } from '../../../shared/outbox/rabbit-event-bus';
import { HandleStockEvent } from '../application/handle-stock-event';
import { readEnvironment } from '../../../config/environment';
const legacySchema = z.discriminatedUnion('name', [
  z
    .object({
      eventId: z.string().uuid(),
      version: z.literal(1),
      occurredAt: z.string().datetime(),
      correlationId: z.string().min(1).max(100),
      name: z.literal('OrderCreated'),
      payload: z
        .object({
          orderId: z.string().uuid(),
          items: z
            .array(
              z
                .object({
                  productId: z.string().uuid(),
                  variantId: z.string().uuid(),
                  weightGrams: z.number().int().min(1).max(100000),
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
  z
    .object({
      eventId: z.string().uuid(),
      version: z.literal(1),
      occurredAt: z.string().datetime(),
      correlationId: z.string().min(1).max(100),
      name: z.literal('OrderCancelled'),
      payload: z
        .object({ orderId: z.string().uuid(), reason: z.enum(['CUSTOMER', 'RESERVATION_TIMEOUT']) })
        .strict(),
    })
    .strict(),
]);
const v2Schema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(2),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.literal('OrderCreated'),
    payload: z
      .object({
        orderId: z.string().uuid(),
        items: z
          .array(
            z
              .object({
                productId: z.string().uuid(),
                variantId: z.string().uuid(),
                stockUnit: z.enum(['GRAM', 'PIECE']),
                stockQuantity: z.number().int().min(1).max(100000),
                quantity: z.number().int().min(1).max(99),
              })
              .strict(),
          )
          .min(1)
          .max(50),
      })
      .strict(),
  })
  .strict();
const shippedSchema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(1),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.literal('OrderShipped'),
    payload: z.object({ orderId: z.string().uuid() }).strict(),
  })
  .strict();
const cancelledV2Schema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(2),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.literal('OrderCancelled'),
    payload: z.object({ orderId: z.string().uuid(), reason: z.literal('ADMIN') }).strict(),
  })
  .strict();
const schema = z.union([legacySchema, v2Schema, shippedSchema, cancelledV2Schema]);
@Injectable()
export class StockWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(
    @Inject(RabbitEventBus) private readonly bus: RabbitEventBus,
    @Inject(HandleStockEvent) private readonly handler: HandleStockEvent,
  ) {}
  onModuleInit() {
    if (readEnvironment().NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.start()
          .catch(() => {})
          .finally(() => {
            this.active = undefined;
          });
    }, 1000);
    this.timer.unref();
  }
  private async start() {
    for (const queue of [
      'catalog.order_created',
      'catalog.order_created_v2',
      'catalog.order_cancelled',
      'catalog.order_shipped',
    ])
      await this.bus.subscribe(queue, async (raw) => {
        await this.handler.execute(schema.parse(raw));
      });
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
