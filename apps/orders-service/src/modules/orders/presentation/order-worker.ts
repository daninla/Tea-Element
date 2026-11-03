import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { z } from 'zod';
import { RabbitEventBus } from '../../../shared/outbox/rabbit-event-bus';
import { readEnvironment } from '../../../config/environment';
import { HandleOrderEvent } from '../application/handle-order-event';
import { ExpireReservations } from '../application/expire-reservations';
const schema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(1),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.enum(['StockReserved', 'StockReservationFailed']),
    payload: z.object({ orderId: z.string().uuid() }).strict(),
  })
  .strict();
@Injectable()
export class OrderWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  constructor(
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
    for (const queue of ['orders.stock_reserved', 'orders.stock_reservation_failed'])
      await this.bus.subscribe(queue, async (raw) => {
        await this.handler.execute(schema.parse(raw));
      });
    await this.expire.execute();
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
  }
}
