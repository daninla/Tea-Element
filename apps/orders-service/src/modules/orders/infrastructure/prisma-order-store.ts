import { randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type {
  CartItemInput,
  CartQuote,
  CreateOrderInput,
  CreatedOrder,
  OrderView,
  OrderStatus,
  QuotedItem,
  DeliveryInput,
  CheckoutEvent,
  StockReserved,
  StockReservationFailed,
} from '@tea/contracts';
import { Prisma, type Order, type OrderStatusHistory } from '../../../../generated/prisma';
import { PrismaService } from '../../../shared/prisma.service';
import { readEnvironment } from '../../../config/environment';
import {
  OrderStore,
  OrderError,
  type AccessInput,
  type CreateContext,
} from '../domain/order-store';
import { mergeCartItems, reservationStatus } from '../domain/order-policy';
import { digest, orderToken, matchesToken } from './order-token';
type Loaded = Order & { history: OrderStatusHistory[] };
function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}
function view(row: Loaded): OrderView {
  return {
    id: row.id,
    number: row.number,
    status: row.status,
    items: row.items as unknown as QuotedItem[],
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    delivery: row.delivery as unknown as DeliveryInput,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    paymentMethod: 'CASH_ON_DELIVERY',
    createdAt: row.createdAt.toISOString(),
    history: row.history.map((h) => ({ status: h.status, at: h.createdAt.toISOString() })),
  };
}
function hashes(input: CreateOrderInput, context: CreateContext) {
  return {
    idempotencyHash: digest(`${context.userId ?? 'guest'}:${context.idempotencyKey}`),
    requestHash: digest(JSON.stringify(input)),
  };
}
@Injectable()
export class PrismaOrderStore extends OrderStore {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {
    super();
  }
  private response(row: Loaded, input: CreateOrderInput, context: CreateContext): CreatedOrder {
    if (row.requestHash !== hashes(input, context).requestHash)
      throw new OrderError('IDEMPOTENCY_CONFLICT', 'This key was used with another order', 409);
    return {
      order: view(row),
      accessToken: orderToken(row.tokenNonce, readEnvironment().ORDER_ACCESS_SECRET),
    };
  }
  async replay(input: CreateOrderInput, context: CreateContext) {
    const row = await this.db.order.findUnique({
      where: { idempotencyHash: hashes(input, context).idempotencyHash },
      include: { history: { orderBy: { createdAt: 'asc' } } },
    });
    return row ? this.response(row, input, context) : null;
  }
  async create(input: CreateOrderInput, context: CreateContext, quote: CartQuote) {
    const key = hashes(input, context);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key.idempotencyHash},0))`;
      const existing = await tx.order.findUnique({
        where: { idempotencyHash: key.idempotencyHash },
        include: { history: { orderBy: { createdAt: 'asc' } } },
      });
      if (existing) return this.response(existing, input, context);
      const id = randomUUID();
      const nonce = randomBytes(32).toString('base64url');
      const token = orderToken(nonce, readEnvironment().ORDER_ACCESS_SECRET);
      const row = await tx.order.create({
        data: {
          id,
          number: `TE-${id.replaceAll('-', '').toUpperCase()}`,
          userId: context.userId ?? null,
          items: json(quote.items),
          subtotal: quote.subtotal,
          discount: quote.discount,
          total: quote.total,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          delivery: json(input.delivery),
          comment: input.comment ?? '',
          marketingConsentAt: input.marketingConsent ? new Date() : null,
          accessTokenHash: digest(token),
          tokenNonce: nonce,
          ...key,
          reservationExpiresAt: new Date(Date.now() + 300000),
          history: { create: { status: 'PENDING' } },
        },
        include: { history: true },
      });
      const event: CheckoutEvent = {
        eventId: randomUUID(),
        name: 'OrderCreated',
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId: context.correlationId,
        payload: {
          orderId: id,
          items: quote.items.map(({ productId, variantId, weightGrams, quantity }) => ({
            productId,
            variantId,
            weightGrams,
            quantity,
          })),
        },
      };
      await this.event(tx, event);
      return { order: view(row), accessToken: token };
    });
  }
  private async accessible(tx: Prisma.TransactionClient, input: AccessInput) {
    const row = await tx.order.findUnique({
      where: { number: input.number },
      include: { history: { orderBy: { createdAt: 'asc' } } },
    });
    if (
      !row ||
      (!(input.userId && row.userId === input.userId) &&
        !matchesToken(input.token, row.accessTokenHash))
    )
      throw new OrderError('ORDER_NOT_FOUND', 'Order not found', 404);
    return row;
  }
  async get(input: AccessInput) {
    return this.db.$transaction(async (tx) => view(await this.accessible(tx, input)));
  }
  async cancel(input: AccessInput, correlationId: string) {
    return this.db.$transaction(async (tx) => {
      // Lock by order ID after resolving access; repeat the read under the lock.
      const initial = await this.accessible(tx, input);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${initial.id},0))`;
      const row = await this.accessible(tx, input);
      if (row.status === 'CANCELLED') return view(row);
      if (!['PENDING', 'CONFIRMED'].includes(row.status))
        throw new OrderError('INVALID_TRANSITION', 'Order cannot be cancelled', 409);
      await this.transition(tx, row.id, 'CANCELLED');
      await this.event(tx, {
        eventId: randomUUID(),
        name: 'OrderCancelled',
        version: 1,
        occurredAt: new Date().toISOString(),
        correlationId,
        payload: { orderId: row.id, reason: 'CUSTOMER' },
      });
      return view(await this.accessible(tx, input));
    });
  }
  async cart(userId: string) {
    const row = await this.db.cart.findUnique({ where: { userId } });
    return (row?.items ?? []) as unknown as CartItemInput[];
  }
  async saveCart(userId: string, items: CartItemInput[], merge: boolean, mergeKey?: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`cart:${userId}`},0))`;
      const current = await tx.cart.findUnique({ where: { userId } });
      if (merge) {
        if (!mergeKey) throw new OrderError('INVALID_INPUT', 'Merge key is required', 400);
        const fingerprint = digest(JSON.stringify(items));
        const previous = await tx.cartMerge.findUnique({
          where: { userId_key: { userId, key: mergeKey } },
        });
        if (previous) {
          if (previous.fingerprint !== fingerprint)
            throw new OrderError('IDEMPOTENCY_CONFLICT', 'Merge key already used', 409);
          return (current?.items ?? []) as unknown as CartItemInput[];
        }
        await tx.cartMerge.create({ data: { userId, key: mergeKey, fingerprint } });
      }
      const next = merge
        ? mergeCartItems((current?.items ?? []) as unknown as CartItemInput[], items)
        : items;
      await tx.cart.upsert({
        where: { userId },
        create: { userId, items: json(next) },
        update: { items: json(next) },
      });
      return next;
    });
  }
  private async event(tx: Prisma.TransactionClient, event: CheckoutEvent) {
    await tx.outbox.create({
      data: {
        id: event.eventId,
        eventName: event.name,
        payload: json(event),
        correlationId: event.correlationId,
      },
    });
  }
  private async transition(tx: Prisma.TransactionClient, id: string, status: OrderStatus) {
    await tx.order.update({ where: { id }, data: { status, history: { create: { status } } } });
  }
  async handle(event: StockReserved | StockReservationFailed) {
    await this.db.$transaction(async (tx) => {
      const id = event.payload.orderId;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${id},0))`;
      if (await tx.processedEvent.findUnique({ where: { eventId: event.eventId } })) return;
      const row = await tx.order.findUnique({ where: { id } });
      if (!row) throw new Error('Unknown order');
      const next = reservationStatus(row.status, event.name);
      if (next !== row.status) {
        await this.transition(tx, id, next);
        if (next === 'CONFIRMED')
          await this.event(tx, {
            eventId: randomUUID(),
            name: 'OrderConfirmed',
            version: 1,
            occurredAt: new Date().toISOString(),
            correlationId: event.correlationId,
            payload: { orderId: id },
          });
      }
      await tx.processedEvent.create({ data: { eventId: event.eventId } });
    });
  }
  async expire() {
    const pending = await this.db.order.findMany({
      where: { status: 'PENDING', reservationExpiresAt: { lte: new Date() } },
      take: 20,
    });
    for (const order of pending)
      await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${order.id},0))`;
        const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        if (current.status !== 'PENDING') return;
        await this.transition(tx, order.id, 'CANCELLED');
        await this.event(tx, {
          eventId: randomUUID(),
          name: 'OrderCancelled',
          version: 1,
          occurredAt: new Date().toISOString(),
          correlationId: randomUUID(),
          payload: { orderId: order.id, reason: 'RESERVATION_TIMEOUT' },
        });
      });
  }
}
