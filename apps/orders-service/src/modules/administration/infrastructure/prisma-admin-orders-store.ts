import { randomUUID, createHash } from 'node:crypto';
import { enqueueFulfillmentNotice } from '../../notifications/infrastructure/enqueue-fulfillment-notice';
import { canShip, canComplete, canCancel } from '../domain/fulfillment-policy';
import { Inject, Injectable } from '@nestjs/common';
import type {
  AdminOrderFilters,
  AdminOrderTransition,
  CheckoutEvent,
  QuotedItem,
} from '@tea/contracts';
import { Prisma } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { OrderError } from '../../orders/domain/order-store';
import { view } from '../../orders/infrastructure/prisma-order-store';
import { AdminOrdersStore } from '../domain/admin-orders-store';
@Injectable()
export class PrismaAdminOrdersStore extends AdminOrdersStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  async list(filters: AdminOrderFilters) {
    const q = filters.q?.trim().replace(/[\\%_]/g, '\\$&');
    const where: Prisma.OrderWhereInput = {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
      ...(filters.customerType
        ? { userId: filters.customerType === 'GUEST' ? null : { not: null } }
        : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lt: new Date(filters.to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: ['number', 'email', 'firstName', 'lastName', 'phone'].map((field) => ({
              [field]: { contains: q, mode: 'insensitive' },
            })),
          }
        : {}),
    };
    const pageSize = 20;
    return this.db.$transaction(
      async (tx) => {
        const total = await tx.order.count({ where });
        const rows = await tx.order.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          skip: (filters.page - 1) * pageSize,
          take: pageSize,
          select: {
            id: true,
            number: true,
            status: true,
            total: true,
            firstName: true,
            lastName: true,
            email: true,
            paymentMethod: true,
            paymentStatus: true,
            createdAt: true,
            userId: true,
          },
        });
        return {
          items: rows.map((row) => ({
            ...row,
            paymentMethod: row.paymentMethod as 'CASH_ON_DELIVERY' | 'ONLINE_CARD',
            createdAt: row.createdAt.toISOString(),
          })),
          page: filters.page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async detail(id: string) {
    return this.db.$transaction(
      async (tx) => {
        const row = await tx.order.findUnique({
          where: { id },
          include: { history: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
        });
        if (!row) throw new OrderError('NOT_FOUND', 'Order not found', 404);
        const actions = await tx.adminOrderCommand.findMany({
          where: { orderId: id },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        });
        return {
          ...view(row),
          userId: row.userId,
          comment: row.comment,
          stockDeductedAt: row.stockDeductedAt?.toISOString() ?? null,
          actions: actions.map((x) => ({
            actorId: x.actorId,
            fromStatus: x.fromStatus,
            status: x.status,
            reason: x.reason,
            at: x.createdAt.toISOString(),
          })),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async transition(input: AdminOrderTransition, actorId: string, correlationId: string) {
    const fingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          actorId,
          status: input.status,
          expectedStatus: input.expectedStatus,
          reason: input.reason,
        }),
      )
      .digest('hex');
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.id},0))`;
      const row = await tx.order.findUnique({ where: { id: input.id } });
      if (!row) throw new OrderError('NOT_FOUND', 'Order not found', 404);
      const previous = await tx.adminOrderCommand.findUnique({
        where: { orderId_key: { orderId: input.id, key: input.key } },
      });
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          throw new OrderError('IDEMPOTENCY_CONFLICT', 'Command key reused', 409);
        return;
      }
      if (row.status !== input.expectedStatus)
        throw new OrderError('STALE_ORDER', 'Order changed; reload before retrying', 409);
      if (
        !(input.status === 'CANCELLED'
          ? canCancel(row)
          : input.status === 'SHIPPED'
            ? canShip(row)
            : canComplete(row))
      )
        throw new OrderError('INVALID_TRANSITION', 'Transition is not allowed', 409);
      await tx.order.update({
        where: { id: input.id },
        data: {
          status: input.status,
          ...(input.status === 'COMPLETED' && row.paymentMethod === 'CASH_ON_DELIVERY'
            ? { paymentStatus: 'PAID' }
            : {}),
          history: { create: { status: input.status } },
        },
      });
      await tx.adminOrderCommand.create({
        data: {
          orderId: input.id,
          key: input.key,
          actorId,
          fromStatus: row.status,
          status: input.status,
          reason: input.reason,
          fingerprint,
        },
      });
      const event: CheckoutEvent = {
        eventId: randomUUID(),
        name:
          input.status === 'CANCELLED'
            ? 'OrderCancelled'
            : input.status === 'SHIPPED'
              ? 'OrderShipped'
              : 'OrderCompleted',
        version: input.status === 'CANCELLED' ? 2 : 1,
        occurredAt: new Date().toISOString(),
        correlationId,
        payload:
          input.status === 'CANCELLED'
            ? { orderId: row.id, reason: 'ADMIN' }
            : input.status === 'SHIPPED'
              ? { orderId: row.id }
              : {
                  orderId: row.id,
                  userId: row.userId,
                  email: row.email,
                  firstName: row.firstName,
                  lastName: row.lastName,
                  marketingConsent: !!row.marketingConsentAt,
                  ...(row.marketingConsentAt
                    ? { marketingConsentAt: row.marketingConsentAt.toISOString() }
                    : {}),
                  total: row.total,
                  items: (row.items as unknown as QuotedItem[]).map((x) => ({
                    productId: x.productId,
                    quantity: x.quantity,
                  })),
                },
      } as CheckoutEvent;
      await tx.outbox.create({
        data: {
          id: event.eventId,
          eventName: event.name,
          correlationId,
          payload: event as unknown as Prisma.InputJsonObject,
        },
      });
      if (input.status !== 'CANCELLED') await enqueueFulfillmentNotice(tx, row, input.status);
    });
    return this.detail(input.id);
  }
}
