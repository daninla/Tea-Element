import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { ADMIN_PAYMENTS_PATTERNS, type OrdersResult } from '@tea/contracts';
import { PaymentError } from '../../payments/domain/payment-store';
import { ReadAdminPayments } from '../application/read-admin-payments';
import { RequestPaymentReconciliation } from '../application/request-payment-reconciliation';
import {
  adminPaymentContext,
  adminPaymentsRead,
  adminReconciliation,
} from './admin-payments-schema';
async function handle<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  run: (input: T, actor: string) => Promise<unknown>,
): Promise<OrdersResult<unknown>> {
  const envelope = z
    .object({ input: z.unknown(), context: adminPaymentContext })
    .strict()
    .safeParse(raw);
  if (!envelope.success)
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
    };
  const input = schema.safeParse(envelope.data.input);
  if (!input.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
    };
  try {
    return { ok: true, value: await run(input.data, envelope.data.context.userId) };
  } catch (e) {
    return {
      ok: false,
      error: {
        code: e instanceof PaymentError ? e.code : 'PAYMENTS_UNAVAILABLE',
        statusCode: e instanceof PaymentError ? e.statusCode : 503,
        message: 'Payment administration unavailable',
      },
    };
  }
}
@Controller()
export class AdminPaymentsRpcController {
  constructor(
    @Inject(ReadAdminPayments) private readonly read: ReadAdminPayments,
    @Inject(RequestPaymentReconciliation) private readonly reconcile: RequestPaymentReconciliation,
  ) {}
  @MessagePattern(ADMIN_PAYMENTS_PATTERNS.read) query(@Payload() raw: unknown) {
    return handle(raw, adminPaymentsRead, (x) => this.read.execute(x));
  }
  @MessagePattern(ADMIN_PAYMENTS_PATTERNS.reconcile) request(@Payload() raw: unknown) {
    return handle(raw, adminReconciliation, (x, actor) => this.reconcile.execute(x, actor));
  }
}
