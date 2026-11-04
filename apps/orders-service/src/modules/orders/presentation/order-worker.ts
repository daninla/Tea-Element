import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { z } from 'zod';
import { RabbitEventBus } from '../../../shared/outbox/rabbit-event-bus';
import { readEnvironment } from '../../../config/environment';
import { AccountOrders } from '../application/account-orders';
import { HandleOrderEvent } from '../application/handle-order-event';
import { ExpireReservations } from '../application/expire-reservations';
const stockSchema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(1),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.enum(['StockReserved', 'StockReservationFailed']),
    payload: z.object({ orderId: z.string().uuid() }).strict(),
  })
  .strict();
const paymentSchema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(1),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.enum(['PaymentSucceeded', 'PaymentFailed', 'PaymentExpired', 'PaymentRefunded']),
    payload: z
      .object({
        paymentId: z.string().uuid(),
        orderId: z.string().uuid(),
        amount: z.number().int().min(1).max(2147483647),
        currency: z.literal('UAH'),
      })
      .strict(),
  })
  .strict();
const schema = z.union([stockSchema, paymentSchema]);
const verifiedSchema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(1),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.literal('UserEmailVerified'),
    payload: z.object({ userId: z.string().uuid(), email: z.string().email().max(320) }).strict(),
  })
  .strict();
@Injectable()
export class OrderWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(
    @Inject(AccountOrders) private readonly account: AccountOrders,
    @Inject(RabbitEventBus) private readonly bus: RabbitEventBus,
    @Inject(HandleOrderEvent) private readonly handler: HandleOrderEvent,
    @Inject(ExpireReservations) private readonly expire: ExpireReservations,
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
    for (const queue of [
      'orders.stock_reserved',
      'orders.stock_reservation_failed',
      'orders.payment_succeeded',
      'orders.payment_failed',
      'orders.payment_expired',
      'orders.payment_refunded',
    ])
      await this.bus.subscribe(queue, async (raw) => {
        await this.handler.execute(schema.parse(raw));
      });
    await this.bus.subscribe(
      'orders.user_email_verified',
      (raw) =>
        this.account.execute({
          action: 'VERIFY',
          event: verifiedSchema.parse(raw),
        }) as Promise<void>,
    );
    await this.account.execute({ action: 'RECONCILE' });
    await this.expire.execute();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
