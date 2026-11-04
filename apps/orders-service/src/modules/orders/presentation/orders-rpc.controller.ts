import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { ORDERS_PATTERNS, type OrdersResult } from '@tea/contracts';
import { OrderError } from '../domain/order-store';
import { AccountOrders } from '../application/account-orders';
import { ChangePayment } from '../application/change-payment';
import { CreateOrder } from '../application/create-order';
import { GetOrder } from '../application/get-order';
import { CancelOrder } from '../application/cancel-order';
import { ReadCart } from '../application/read-cart';
import { SaveCart } from '../application/save-cart';
import { MergeCart } from '../application/merge-cart';
import { QuoteCart } from '../application/quote-cart';
import { cartItems, createInput, access, context } from './orders-schema';
async function handle<T, R>(
  raw: unknown,
  input: z.ZodType<T>,
  execute: (input: T, ctx: z.infer<typeof context>) => Promise<R>,
): Promise<OrdersResult<R>> {
  const parsed = z.object({ input, context }).strict().safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid request', statusCode: 400 },
    };
  try {
    return { ok: true, value: await execute(parsed.data.input as T, parsed.data.context) };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof OrderError
          ? { code: error.code, message: error.message, statusCode: error.statusCode }
          : {
              code: 'ORDERS_UNAVAILABLE',
              message: 'Orders temporarily unavailable',
              statusCode: 503,
            },
    };
  }
}
function user(id: string | undefined) {
  if (!id) throw new OrderError('UNAUTHORIZED', 'Authentication required', 401);
  return id;
}
@Controller()
export class OrdersRpcController {
  constructor(
    @Inject(AccountOrders) private readonly account: AccountOrders,
    @Inject(ChangePayment) private readonly change: ChangePayment,
    @Inject(CreateOrder) private readonly create: CreateOrder,
    @Inject(GetOrder) private readonly get: GetOrder,
    @Inject(CancelOrder) private readonly cancel: CancelOrder,
    @Inject(ReadCart) private readonly readCart: ReadCart,
    @Inject(SaveCart) private readonly saveCart: SaveCart,
    @Inject(MergeCart) private readonly mergeCart: MergeCart,
    @Inject(QuoteCart) private readonly quote: QuoteCart,
  ) {}
  @MessagePattern(ORDERS_PATTERNS.quote) quoteCart(@Payload() raw: unknown) {
    return handle(raw, z.object({ items: cartItems }).strict(), (x, c) =>
      this.quote.execute(x.items, c.correlationId),
    );
  }
  @MessagePattern(ORDERS_PATTERNS.create) createOrder(@Payload() raw: unknown) {
    return handle(
      raw,
      z.object({ order: createInput, idempotencyKey: z.string().uuid() }).strict(),
      (x, c) => this.create.execute(x.order, { ...c, idempotencyKey: x.idempotencyKey }),
    );
  }
  @MessagePattern(ORDERS_PATTERNS.get) getOrder(@Payload() raw: unknown) {
    return handle(raw, access, (x, c) => this.get.execute({ ...x, userId: c.userId }));
  }
  @MessagePattern(ORDERS_PATTERNS.cancel) cancelOrder(@Payload() raw: unknown) {
    return handle(raw, access, (x, c) =>
      this.cancel.execute({ ...x, userId: c.userId }, c.correlationId),
    );
  }
  @MessagePattern(ORDERS_PATTERNS.changePayment) changePayment(@Payload() raw: unknown) {
    return handle(
      raw,
      access.extend({ action: z.enum(['RETRY', 'COD']), key: z.string().uuid() }).strict(),
      (x, c) =>
        this.change.execute(
          { number: x.number, token: x.token, userId: c.userId },
          x.action,
          x.key,
          c.correlationId,
        ),
    );
  }
  @MessagePattern(ORDERS_PATTERNS.list) list(@Payload() raw: unknown) {
    return handle(raw, z.object({ page: z.number().int().min(1).max(10000) }).strict(), (x, c) =>
      this.account.execute({ action: 'LIST', userId: user(c.userId), page: x.page }),
    );
  }
  @MessagePattern(ORDERS_PATTERNS.lookup) lookup(@Payload() raw: unknown) {
    return handle(
      raw,
      z
        .object({
          number: z.string().regex(/^TE-[A-F0-9]{32}$/),
          email: z.string().trim().email().max(320),
        })
        .strict(),
      (x) => this.account.execute({ action: 'LOOKUP', ...x }),
    );
  }
  @MessagePattern(ORDERS_PATTERNS.cart) cart(@Payload() raw: unknown) {
    return handle(raw, z.object({}).strict(), (_, c) => this.readCart.execute(user(c.userId)));
  }
  @MessagePattern(ORDERS_PATTERNS.saveCart) save(@Payload() raw: unknown) {
    return handle(raw, z.object({ items: cartItems }).strict(), (x, c) =>
      this.saveCart.execute(user(c.userId), x.items),
    );
  }
  @MessagePattern(ORDERS_PATTERNS.mergeCart) merge(@Payload() raw: unknown) {
    return handle(
      raw,
      z.object({ items: cartItems, mergeKey: z.string().uuid() }).strict(),
      (x, c) => this.mergeCart.execute(user(c.userId), x.items, x.mergeKey),
    );
  }
}
