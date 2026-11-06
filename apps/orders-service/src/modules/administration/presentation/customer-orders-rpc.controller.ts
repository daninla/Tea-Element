import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { ADMIN_CUSTOMERS_PATTERNS, type OrdersResult } from '@tea/contracts';
import { adminContext } from './admin-orders-schema';
import { OrderError } from '../../orders/domain/order-store';
import { ReadCustomerOrders } from '../application/read-customer-orders';
const page = z.number().int().min(1).max(10000);
const customer = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ACCOUNT'), id: z.string().uuid() }).strict(),
  z
    .object({ kind: z.literal('GUEST'), email: z.string().trim().toLowerCase().email().max(320) })
    .strict(),
]);
const query = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('GUESTS'), page, q: z.string().trim().max(100).optional() }).strict(),
  z.object({ kind: z.literal('HISTORY'), customer, page }).strict(),
]);
@Controller()
export class CustomerOrdersRpcController {
  constructor(@Inject(ReadCustomerOrders) private readonly read: ReadCustomerOrders) {}
  @MessagePattern(ADMIN_CUSTOMERS_PATTERNS.orders) async execute(
    @Payload() raw: unknown,
  ): Promise<OrdersResult<unknown>> {
    const envelope = z
      .object({ input: z.unknown(), context: adminContext })
      .strict()
      .safeParse(raw);
    if (!envelope.success)
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
      };
    const parsed = query.safeParse(envelope.data.input);
    if (!parsed.success)
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
      };
    try {
      return { ok: true, value: await this.read.execute(parsed.data) };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof OrderError
            ? { code: e.code, message: e.message, statusCode: e.statusCode }
            : {
                code: 'ORDERS_UNAVAILABLE',
                message: 'Customer history unavailable',
                statusCode: 503,
              },
      };
    }
  }
}
