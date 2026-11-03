import { Inject, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createTransport } from 'nodemailer';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { orderToken } from './order-token';
@Injectable()
export class ReceiptWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private active?: Promise<void>;
  private readonly transport = createTransport(readEnvironment().SMTP_URL, {
    connectionTimeout: 3000,
    socketTimeout: 5000,
  });
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  onModuleInit() {
    if (readEnvironment().NODE_ENV === 'test') return;
    this.timer = setInterval(() => {
      if (!this.active)
        this.active = this.send()
          .catch(() => {})
          .finally(() => {
            this.active = undefined;
          });
    }, 3000);
    this.timer.unref();
  }
  async send() {
    await this.db.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM orders WHERE receipt_sent_at IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
        if (!rows[0]) return;
        const order = await tx.order.findUniqueOrThrow({ where: { id: rows[0].id } });
        const link = new URL(`/order/${order.number}`, readEnvironment().WEB_URL);
        link.searchParams.set(
          'token',
          orderToken(order.tokenNonce, readEnvironment().ORDER_ACCESS_SECRET),
        );
        await this.transport.sendMail({
          from: 'Чайний елемент <orders@tea-element.test>',
          to: order.email,
          subject: `Замовлення ${order.number}`,
          messageId: `<order-${order.id}@tea-element.test>`,
          text: `Дякуємо! Замовлення ${order.number} отримано.\nСума товарів: ${(order.total / 100).toFixed(2)} UAH. Оплата при отриманні.\nСтатус, склад і доставка: ${link.href}\nПосилання приватне — не передавайте його іншим. Це демонстраційний магазин.`,
        });
        await tx.order.update({ where: { id: order.id }, data: { receiptSentAt: new Date() } });
      },
      { timeout: 10000 },
    );
  }
  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.active;
    this.transport.close();
  }
}
