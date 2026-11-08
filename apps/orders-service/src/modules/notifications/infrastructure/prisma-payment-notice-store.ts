import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { orderToken } from '../../orders/infrastructure/order-token';
import { PaymentNoticeStore, type PaymentNoticeKind } from '../domain/payment-notice';
@Injectable()
export class PrismaPaymentNoticeStore extends PaymentNoticeStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async claim() {
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      await tx.orderPaymentNotice.updateMany({
        where: { status: 'PENDING', attempts: { gte: 3 }, leaseUntil: { lte: now } },
        data: { status: 'FAILED', leaseId: null, leaseUntil: null },
      });
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM order_payment_notices WHERE status='PENDING' AND attempts<3
        AND next_attempt_at<=${now} AND (lease_until IS NULL OR lease_until<=${now})
        ORDER BY next_attempt_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      const notice = await tx.orderPaymentNotice.findUniqueOrThrow({
        where: { id: rows[0].id },
        include: { order: true },
      });
      // A refund can arrive while a crashed sender's lease is expiring.
      if (
        notice.kind === 'RECEIVED' &&
        (await tx.orderPaymentNotice.findUnique({
          where: { paymentId_kind: { paymentId: notice.paymentId, kind: 'REFUNDED' } },
        }))
      ) {
        await tx.orderPaymentNotice.update({
          where: { id: notice.id },
          data: { status: 'SUPPRESSED', leaseId: null, leaseUntil: null },
        });
        return null;
      }
      const leaseId = randomUUID();
      await tx.orderPaymentNotice.update({
        where: { id: notice.id },
        data: { attempts: { increment: 1 }, leaseId, leaseUntil: new Date(now.getTime() + 60000) },
      });
      const link = new URL(`/order/${notice.order.number}`, readEnvironment().WEB_URL);
      link.searchParams.set(
        'token',
        orderToken(notice.order.tokenNonce, readEnvironment().ORDER_ACCESS_SECRET),
      );
      return {
        id: notice.id,
        leaseId,
        kind: notice.kind as PaymentNoticeKind,
        orderNumber: notice.order.number,
        paymentId: notice.paymentId,
        email: notice.order.email,
        firstName: notice.order.firstName,
        amount: notice.amount,
        currency: notice.currency,
        link: link.href,
      };
    });
  }
  async finish(id: string, leaseId: string, sent: boolean) {
    await this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { attempts: number }[]
      >`SELECT attempts FROM order_payment_notices WHERE id=${id}::uuid AND lease_id=${leaseId}::uuid AND status='PENDING' FOR UPDATE`;
      if (!rows[0]) return;
      await tx.orderPaymentNotice.update({
        where: { id },
        data: {
          status: sent ? 'SENT' : rows[0].attempts >= 3 ? 'FAILED' : 'PENDING',
          sentAt: sent ? new Date() : null,
          leaseId: null,
          leaseUntil: null,
          nextAttemptAt: new Date(Date.now() + 5000 * 2 ** (rows[0].attempts - 1)),
        },
      });
    });
  }
}
