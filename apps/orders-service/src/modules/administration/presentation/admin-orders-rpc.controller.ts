import { TransitionAdminOrder } from '../application/transition-admin-order';
import { ORDER_STATUSES } from '@tea/contracts';
import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { ADMIN_ORDERS_PATTERNS, type OrdersResult } from '@tea/contracts';
import { OrderError } from '../../orders/domain/order-store';
import { ReadAdminOrders } from '../application/read-admin-orders';
import { ReadAdminOrder } from '../application/read-admin-order';
import { adminContext, adminOrderFilters } from './admin-orders-schema';
async function handle<T>(
  raw: unknown,
  input: z.ZodType<T>,
  run: (value: T, actorId: string, correlationId: string) => Promise<unknown>,
): Promise<OrdersResult<unknown>> {
  const envelope = z.object({ input: z.unknown(), context: adminContext }).strict().safeParse(raw);
  if (!envelope.success)
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
    };
  const parsed = input.safeParse(envelope.data.input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
    };
  try {
    return {
      ok: true,
      value: await run(
        parsed.data,
        envelope.data.context.userId,
        envelope.data.context.correlationId,
      ),
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof OrderError
          ? { code: e.code, message: e.message, statusCode: e.statusCode }
          : {
              code: 'ORDERS_UNAVAILABLE',
              message: 'Orders temporarily unavailable',
              statusCode: 503,
            },
    };
  }
}
@Controller()
export class AdminOrdersRpcController {
  constructor(
    @Inject(TransitionAdminOrder) private readonly transition: TransitionAdminOrder,
    @Inject(ReadAdminOrders) private readonly list: ReadAdminOrders,
    @Inject(ReadAdminOrder) private readonly detail: ReadAdminOrder,
  ) {}
  @MessagePattern(ADMIN_ORDERS_PATTERNS.list) read(@Payload() raw: unknown) {
    return handle(raw, adminOrderFilters, (x) => this.list.execute(x));
  }
  @MessagePattern(ADMIN_ORDERS_PATTERNS.detail) get(@Payload() raw: unknown) {
    return handle(raw, z.object({ id: z.string().uuid() }).strict(), (x) =>
      this.detail.execute(x.id),
    );
  }
  @MessagePattern(ADMIN_ORDERS_PATTERNS.transition) change(@Payload() raw: unknown) {
    return handle(
      raw,
      z
        .object({
          id: z.string().uuid(),
          status: z.enum(['SHIPPED', 'COMPLETED']),
          expectedStatus: z.enum(ORDER_STATUSES),
          reason: z.string().trim().min(3).max(500),
          key: z.string().uuid(),
        })
        .strict(),
      (x, actor, c) => this.transition.execute(x, actor, c),
    );
  }
}
