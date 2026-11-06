import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AdminPaymentsRead,
  AdminPayment,
  AdminReconciliation,
  ReconciliationReceipt,
} from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import { PaymentError } from '../../payments/domain/payment-store';
import { AdminPaymentsStore, canRequestReconciliation } from '../domain/admin-payments-store';
const select = {
  id: true,
  orderId: true,
  orderNumber: true,
  amount: true,
  currency: true,
  provider: true,
  status: true,
  providerPaymentId: true,
  cancelRequested: true,
  expiresAt: true,
  paidAt: true,
  nextReconcileAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
const map = (
  x: Prisma.PaymentGetPayload<{ select: typeof select }>,
  refundStatus: string | null,
): AdminPayment => ({
  ...x,
  expiresAt: x.expiresAt.toISOString(),
  paidAt: x.paidAt?.toISOString() ?? null,
  nextReconcileAt: x.nextReconcileAt.toISOString(),
  createdAt: x.createdAt.toISOString(),
  updatedAt: x.updatedAt.toISOString(),
  refundStatus,
});
@Injectable()
export class PrismaAdminPaymentsStore extends AdminPaymentsStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  read(input: AdminPaymentsRead) {
    return this.db.$transaction(
      async (tx) => {
        if (input.kind === 'DETAIL') {
          const payment = await tx.payment.findUnique({ where: { id: input.id }, select });
          if (!payment) throw new PaymentError('PAYMENT_NOT_FOUND', 404);
          const refund = await tx.refund.findUnique({
            where: { paymentId: input.id },
            select: { id: true, amount: true, status: true, createdAt: true, updatedAt: true },
          });
          return {
            payment: map(payment, refund?.status ?? null),
            refund: refund
              ? {
                  ...refund,
                  createdAt: refund.createdAt.toISOString(),
                  updatedAt: refund.updatedAt.toISOString(),
                }
              : null,
          };
        }
        if (input.kind === 'EVENTS') {
          const where = {
            ...(input.paymentId ? { paymentId: input.paymentId } : {}),
            ...(input.signatureValid !== undefined ? { signatureValid: input.signatureValid } : {}),
          };
          const total = await tx.paymentEvent.count({ where }),
            rows = await tx.paymentEvent.findMany({
              where,
              select: {
                id: true,
                paymentId: true,
                signatureValid: true,
                outcome: true,
                createdAt: true,
              },
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              take: 20,
              skip: (input.page - 1) * 20,
            });
          return {
            items: rows.map((x) => ({ ...x, createdAt: x.createdAt.toISOString() })),
            page: input.page,
            total,
            totalPages: Math.max(1, Math.ceil(total / 20)),
          };
        }
        if (input.kind === 'COMMANDS') {
          const where = { paymentId: input.id };
          const total = await tx.paymentAdminCommand.count({ where }),
            rows = await tx.paymentAdminCommand.findMany({
              where,
              select: { id: true, actorId: true, reason: true, attemptedAt: true, createdAt: true },
              orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
              take: 20,
              skip: (input.page - 1) * 20,
            });
          return {
            items: rows.map((x) => ({
              ...x,
              attemptedAt: x.attemptedAt?.toISOString() ?? null,
              createdAt: x.createdAt.toISOString(),
            })),
            page: input.page,
            total,
            totalPages: Math.max(1, Math.ceil(total / 20)),
          };
        }
        const q = input.q?.trim().replace(/[\\%_]/g, '\\$&');
        const predicates: Prisma.Sql[] = [];
        if (q)
          predicates.push(
            Prisma.sql`(p.order_number ILIKE ${'%' + q + '%'} OR p.id::text ILIKE ${'%' + q + '%'})`,
          );
        if (input.status) predicates.push(Prisma.sql`p.status::text=${input.status}`);
        if (input.provider) predicates.push(Prisma.sql`p.provider=${input.provider}`);
        if (input.from) predicates.push(Prisma.sql`p.created_at>=${new Date(input.from)}`);
        if (input.to) predicates.push(Prisma.sql`p.created_at<${new Date(input.to)}`);
        if (input.refundOnly)
          predicates.push(Prisma.sql`EXISTS(SELECT 1 FROM refunds r WHERE r.payment_id=p.id)`);
        const where = predicates.length
          ? Prisma.sql`WHERE ${Prisma.join(predicates, ' AND ')}`
          : Prisma.empty;
        const [count] = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*)::bigint AS total FROM payments p ${where}`,
        );
        const ids = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT p.id FROM payments p ${where} ORDER BY p.created_at DESC,p.id LIMIT 20 OFFSET ${(input.page - 1) * 20}`,
        );
        const total = Number(count!.total);
        if (!Number.isSafeInteger(total)) throw new PaymentError('PAYMENTS_UNAVAILABLE', 503);
        const rows = await tx.payment.findMany({
          where: { id: { in: ids.map((x) => x.id) } },
          select,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        });
        const jobs = await tx.refund.findMany({
          where: { paymentId: { in: rows.map((x) => x.id) } },
          select: { paymentId: true, status: true },
        });
        const states = new Map(jobs.map((x) => [x.paymentId, x.status]));
        return {
          items: rows.map((x) => map(x, states.get(x.id) ?? null)),
          page: input.page,
          total,
          totalPages: Math.max(1, Math.ceil(total / 20)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async reconcile(input: AdminReconciliation, actorId: string): Promise<ReconciliationReceipt> {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ actorId, ...input }))
      .digest('hex');
    return this.db.$transaction(async (tx) => {
      const lock = 'admin-payment:' + input.key;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock},0))`;
      const old = await tx.paymentAdminCommand.findUnique({ where: { key: input.key } });
      if (old) {
        if (old.fingerprint !== fingerprint) throw new PaymentError('IDEMPOTENCY_CONFLICT', 409);
        return old.result as unknown as ReconciliationReceipt;
      }
      const initial = await tx.payment.findUnique({
        where: { id: input.paymentId },
        select: { orderId: true },
      });
      if (!initial) throw new PaymentError('PAYMENT_NOT_FOUND', 404);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${initial.orderId},0))`;
      const row = await tx.payment.findUniqueOrThrow({ where: { id: input.paymentId } });
      if (row.status !== input.expectedStatus || !canRequestReconciliation(row.status))
        throw new PaymentError('PAYMENT_STATE_CONFLICT', 409);
      if (row.provider !== readEnvironment().PAYMENT_PROVIDER.toUpperCase())
        throw new PaymentError('PROVIDER_NOT_ACTIVE', 409);
      const now = new Date(),
        result: ReconciliationReceipt = {
          id: randomUUID(),
          paymentId: row.id,
          requestedAt: now.toISOString(),
          status: 'QUEUED',
        };
      await tx.payment.update({ where: { id: row.id }, data: { nextReconcileAt: now } });
      await tx.paymentAdminCommand.create({
        data: {
          id: result.id,
          key: input.key,
          paymentId: row.id,
          actorId,
          reason: input.reason,
          fingerprint,
          result: result as unknown as Prisma.InputJsonObject,
        },
      });
      return result;
    });
  }
}
