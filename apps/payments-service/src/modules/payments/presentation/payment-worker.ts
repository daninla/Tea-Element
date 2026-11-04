import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { z } from 'zod';
import { RabbitEventBus } from '../../../shared/outbox/rabbit-event-bus';
import { readEnvironment } from '../../../config/environment';
import { HandlePaymentEvent } from '../application/handle-payment-event';
import { MaintainPayments } from '../application/maintain-payments';
const envelope = {
  eventId: z.string().uuid(),
  occurredAt: z.string().datetime(),
  correlationId: z.string().min(1).max(100),
  version: z.literal(1),
};
const schema = z.discriminatedUnion('name', [
  z
    .object({
      ...envelope,
      name: z.literal('PaymentAttemptAbandoned'),
      payload: z.object({ orderId: z.string().uuid(), paymentId: z.string().uuid() }).strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      name: z.literal('PaymentRequested'),
      payload: z
        .object({
          paymentId: z.string().uuid(),
          orderId: z.string().uuid(),
          orderNumber: z.string().regex(/^TE-[A-F0-9]{32}$/),
          amount: z.number().int().min(1).max(2147483647),
          currency: z.literal('UAH'),
          expiresAt: z.string().datetime(),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      ...envelope,
      name: z.literal('OrderCancelled'),
      payload: z
        .object({ orderId: z.string().uuid(), reason: z.enum(['CUSTOMER', 'RESERVATION_TIMEOUT']) })
        .strict(),
    })
    .strict(),
]);
@Injectable()
export class PaymentWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(
    @Inject(RabbitEventBus) private readonly bus: RabbitEventBus,
    @Inject(HandlePaymentEvent) private readonly handler: HandlePaymentEvent,
    @Inject(MaintainPayments) private readonly maintenance: MaintainPayments,
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
      'payments.payment_requested',
      'payments.order_cancelled',
      'payments.payment_attempt_abandoned',
    ])
      await this.bus.subscribe(queue, (raw) => this.handler.execute(schema.parse(raw)));
    await this.maintenance.execute();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
