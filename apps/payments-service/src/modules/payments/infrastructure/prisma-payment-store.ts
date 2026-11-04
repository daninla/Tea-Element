import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentRequested,
  PaymentAttemptAbandoned,
  OrderCancelled,
  CheckoutEvent,
  PaymentOutcome,
} from '@tea/contracts';
import { Prisma, type Payment } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { PaymentStore, PaymentError, type StoredPayment } from '../domain/payment-store';
import { paymentTransition } from '../domain/payment-policy';
import { matchPayment } from '../domain/payment-validation';
import type { PaymentObservation, ProviderWebhook } from '../domain/payment-provider';
import { readEnvironment } from '../../../config/environment';
const json = (x: unknown) => x as Prisma.InputJsonValue;
function view(row: Payment): StoredPayment {
  return { ...row, currency: 'UAH', expiresAt: row.expiresAt.toISOString() };
}
@Injectable()
export class PrismaPaymentStore extends PaymentStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  private async lock(tx: Prisma.TransactionClient, id: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
  }
  private async event(
    tx: Prisma.TransactionClient,
    row: Payment,
    name: PaymentOutcome['name'],
    correlationId: string,
  ) {
    const event: CheckoutEvent = {
      eventId: randomUUID(),
      name,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId,
      payload: { paymentId: row.id, orderId: row.orderId, amount: row.amount, currency: 'UAH' },
    };
    await tx.outbox.create({
      data: { id: event.eventId, eventName: event.name, payload: json(event), correlationId },
    });
  }
  async register(event: PaymentRequested) {
    await this.db.$transaction(async (tx) => {
      const p = event.payload;
      await this.lock(tx, p.orderId);
      if (await tx.processedEvent.findUnique({ where: { eventId: event.eventId } })) return;
      const old = await tx.payment.findUnique({ where: { id: p.paymentId } });
      if (old) {
        if (
          old.id !== p.paymentId ||
          old.orderId !== p.orderId ||
          old.amount !== p.amount ||
          old.currency !== p.currency ||
          old.orderNumber !== p.orderNumber ||
          old.expiresAt.toISOString() !== p.expiresAt
        )
          throw new PaymentError('PAYMENT_CONFLICT', 409);
      } else {
        const cancelled =
          !!(await tx.cancelledOrder.findUnique({ where: { orderId: p.orderId } })) ||
          !!(await tx.abandonedAttempt.findUnique({ where: { paymentId: p.paymentId } }));
        await tx.payment.create({
          data: {
            id: p.paymentId,
            orderId: p.orderId,
            orderNumber: p.orderNumber,
            amount: p.amount,
            currency: p.currency,
            provider: readEnvironment().PAYMENT_PROVIDER.toUpperCase(),
            expiresAt: new Date(p.expiresAt),
            cancelRequested: cancelled,
            status: cancelled ? 'EXPIRED' : 'PENDING',
          },
        });
      }
      await tx.processedEvent.create({ data: { eventId: event.eventId } });
    });
  }
  private async scheduleRefund(tx: Prisma.TransactionClient, row: Payment) {
    if (row.cancelRequested && row.status === 'SUCCEEDED')
      await tx.refund.upsert({
        where: { paymentId: row.id },
        create: { paymentId: row.id, amount: row.amount },
        update: {},
      });
  }
  async cancel(event: OrderCancelled | PaymentAttemptAbandoned) {
    await this.db.$transaction(async (tx) => {
      const id = event.payload.orderId;
      await this.lock(tx, id);
      if (await tx.processedEvent.findUnique({ where: { eventId: event.eventId } })) return;
      if (event.name === 'OrderCancelled')
        await tx.cancelledOrder.upsert({
          where: { orderId: id },
          create: { orderId: id },
          update: {},
        });
      else
        await tx.abandonedAttempt.upsert({
          where: { paymentId: event.payload.paymentId },
          create: { orderId: id, paymentId: event.payload.paymentId },
          update: {},
        });
      const rows = await tx.payment.findMany({
        where: {
          orderId: id,
          ...(event.name === 'PaymentAttemptAbandoned' ? { id: event.payload.paymentId } : {}),
        },
      });
      for (const row of rows) {
        const next = await tx.payment.update({
          where: { id: row.id },
          data: { cancelRequested: true },
        });
        await this.scheduleRefund(tx, next);
      }
      await tx.processedEvent.create({ data: { eventId: event.eventId } });
    });
  }
  async find(id: string) {
    const row = await this.db.payment.findUnique({ where: { id } });
    return row ? view(row) : null;
  }
  async forOrder(orderId: string) {
    const row = await this.db.payment.findFirst({
      where: { orderId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return row ? view(row) : null;
  }
  async audit(raw: ProviderWebhook, valid: boolean) {
    return (
      await this.db.paymentEvent.create({ data: { rawPayload: json(raw), signatureValid: valid } })
    ).id;
  }
  async auditOutcome(id: string, outcome: string, paymentId?: string) {
    await this.db.paymentEvent.update({ where: { id }, data: { outcome, paymentId } });
  }
  async observe(observation: PaymentObservation, correlationId: string) {
    await this.db.$transaction(async (tx) => {
      const initial = await tx.payment.findUniqueOrThrow({ where: { id: observation.paymentId } });
      await this.lock(tx, initial.orderId);
      const row = await tx.payment.findUniqueOrThrow({ where: { id: observation.paymentId } });
      matchPayment(observation, { paymentId: row.id, amount: row.amount, currency: 'UAH' });
      if (
        row.providerPaymentId &&
        observation.providerPaymentId &&
        row.providerPaymentId !== observation.providerPaymentId
      )
        throw new PaymentError('PAYMENT_MISMATCH', 400);
      const next = paymentTransition(row.status, observation.status) as Payment['status'];
      const saved = await tx.payment.update({
        where: { id: row.id },
        data: {
          status: next,
          providerPaymentId: observation.providerPaymentId,
          paidAt: next === 'SUCCEEDED' ? (row.paidAt ?? new Date()) : row.paidAt,
          cancelRequested: row.cancelRequested || next === 'FAILED',
          nextReconcileAt: new Date(Date.now() + 30000),
        },
      });
      if (next !== row.status) {
        if (next === 'SUCCEEDED') await this.event(tx, saved, 'PaymentSucceeded', correlationId);
        if (next === 'FAILED') await this.event(tx, saved, 'PaymentFailed', correlationId);
        if (next === 'REFUNDED') await this.event(tx, saved, 'PaymentRefunded', correlationId);
      }
      if (next === 'REFUNDED')
        await tx.refund.updateMany({ where: { paymentId: row.id }, data: { status: 'COMPLETED' } });
      await this.scheduleRefund(tx, saved);
    });
  }
  async due() {
    const rows = await this.db.payment.findMany({
      where: {
        status: { in: ['CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'] },
        nextReconcileAt: { lte: new Date() },
      },
      orderBy: { nextReconcileAt: 'asc' },
      take: 20,
    });
    return rows.map(view);
  }
  async defer(id: string) {
    await this.db.payment.update({
      where: { id },
      data: { nextReconcileAt: new Date(Date.now() + 30000) },
    });
  }
  async expire() {
    await this.db.refund.updateMany({
      where: { status: 'IN_FLIGHT', updatedAt: { lt: new Date(Date.now() - 60000) } },
      data: { status: 'REVIEW_REQUIRED' },
    });
    const rows = await this.db.payment.findMany({
      where: { status: { in: ['CREATED', 'PENDING'] }, expiresAt: { lte: new Date() } },
      take: 20,
    });
    for (const row of rows)
      await this.db.$transaction(async (tx) => {
        await this.lock(tx, row.orderId);
        const current = await tx.payment.findUniqueOrThrow({ where: { id: row.id } });
        if (!['CREATED', 'PENDING'].includes(current.status) || current.expiresAt > new Date())
          return;
        const saved = await tx.payment.update({
          where: { id: row.id },
          data: { status: 'EXPIRED', cancelRequested: true },
        });
        await this.event(tx, saved, 'PaymentExpired', randomUUID());
      });
  }
  async claimRefund() {
    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        { payment_id: string }[]
      >`SELECT payment_id FROM refunds WHERE status='REQUESTED' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`;
      const id = rows[0]?.payment_id;
      if (!id) return null;
      await tx.refund.update({ where: { paymentId: id }, data: { status: 'IN_FLIGHT' } });
      return view(await tx.payment.findUniqueOrThrow({ where: { id } }));
    });
  }
  async refundResult(
    id: string,
    status: 'PENDING' | 'REFUNDED' | 'REVIEW_REQUIRED',
    correlationId: string,
  ) {
    if (status === 'REFUNDED') {
      const row = await this.find(id);
      if (!row) throw new PaymentError('PAYMENT_NOT_FOUND', 404);
      await this.observe(
        { paymentId: id, amount: row.amount, currency: 'UAH', status: 'REFUNDED' },
        correlationId,
      );
    } else
      await this.db.refund.update({
        where: { paymentId: id },
        data: { status: status === 'PENDING' ? 'WAITING' : status },
      });
  }
}
