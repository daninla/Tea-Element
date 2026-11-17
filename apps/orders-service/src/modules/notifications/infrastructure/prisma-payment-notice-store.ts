import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { orderToken } from '../../orders/infrastructure/order-token';
import {
  PaymentNoticeStore,
  type PaymentNotice,
  type PaymentNoticeKind,
} from '../domain/payment-notice';
@Injectable()
export class PrismaPaymentNoticeStore extends PaymentNoticeStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async claim(): Promise<PaymentNotice | null> {
    const env = readEnvironment();
    const ownerEmail = env.ORDER_OWNER_EMAIL;
    return this.db.$transaction(async (tx) => {
      const now = new Date();
      await tx.orderPaymentNotice.updateMany({
        where: { status: 'PENDING', attempts: { gte: 3 }, leaseUntil: { lte: now } },
        data: { status: 'FAILED', leaseId: null, leaseUntil: null },
      });
      const rows = await tx.$queryRaw<{ id: string }[]>`
        SELECT n.id FROM order_payment_notices n WHERE n.status='PENDING' AND n.attempts<3
        AND n.next_attempt_at<=${now} AND (n.lease_until IS NULL OR n.lease_until<=${now})
        AND (n.kind<>'OWNER_NEW_ORDER' OR ${!!ownerEmail})
        AND (n.kind<>'COMPLETED' OR NOT EXISTS (
          SELECT 1 FROM order_payment_notices earlier WHERE earlier.order_id=n.order_id
          AND earlier.kind='SHIPPED' AND earlier.status='PENDING'
        ))
        ORDER BY n.next_attempt_at,n.created_at,n.id FOR UPDATE OF n SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      const notice = await tx.orderPaymentNotice.findUniqueOrThrow({
        where: { id: rows[0].id },
        include: { order: true },
      });
      // A refund can arrive while a crashed sender's lease is expiring.
      if (
        notice.kind === 'RECEIVED' &&
        notice.paymentId &&
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
      const base = {
        id: notice.id,
        leaseId,
        orderNumber: notice.order.number,
        amount: notice.amount,
        currency: notice.currency,
      };
      if (notice.kind === 'OWNER_NEW_ORDER') {
        if (!ownerEmail) throw new Error('Owner notification recipient is unavailable');
        return {
          ...base,
          kind: notice.kind,
          online: notice.order.paymentMethod === 'ONLINE_CARD',
          email: ownerEmail,
          link: new URL(`/admin/orders/${notice.orderId}`, env.WEB_URL).href,
        };
      }
      const link = new URL(`/order/${notice.order.number}`, env.WEB_URL);
      link.searchParams.set('token', orderToken(notice.order.tokenNonce, env.ORDER_ACCESS_SECRET));
      return {
        ...base,
        kind: notice.kind as PaymentNoticeKind,
        paymentId: notice.paymentId,
        email: notice.order.email,
        firstName: notice.order.firstName,
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
