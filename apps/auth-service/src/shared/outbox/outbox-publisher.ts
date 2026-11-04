import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { AuthEvent } from '@tea/contracts';
import { PrismaService } from '../prisma.service';
import { RabbitEventBus } from './rabbit-event-bus';
import { readEnvironment } from '../../config/environment';
@Injectable()
export class OutboxPublisher implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private inFlight?: Promise<void>;
  constructor(
    @Inject(PrismaService) private readonly db: PrismaService,
    @Inject(RabbitEventBus) private readonly bus: RabbitEventBus,
  ) {}
  onModuleInit() {
    if (readEnvironment().NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.inFlight)
        this.inFlight = this.flush()
          .catch(() => {})
          .finally(() => {
            this.inFlight = undefined;
          });
    }, 2000);
    this.timer.unref();
  }
  async flush() {
    await this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM outbox WHERE published_at IS NULL AND next_attempt_at <= NOW() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
        const id = rows[0]?.id;
        if (!id) return;
        const row = await tx.outbox.findUniqueOrThrow({ where: { id } });
        try {
          await this.bus.publish(row.payload as unknown as AuthEvent);
          await tx.outbox.update({
            where: { id },
            data: { publishedAt: new Date(), attempts: { increment: 1 } },
          });
        } catch {
          const delay = Math.min(300000, 1000 * 2 ** Math.min(row.attempts, 8));
          await tx.outbox.update({
            where: { id },
            data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + delay) },
          });
        }
      },
      { timeout: 10000 },
    );
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }
}
