import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { PAYMENTS_PATTERNS, type OrdersResult } from '@tea/contracts';
import { SimulatePayment } from '../application/simulate-payment';
import { RecordWebhook } from '../application/record-webhook';
import { GetPayment } from '../application/get-payment';
import { PaymentError } from '../domain/payment-store';
import { PaymentProviderError } from '../domain/payment-provider';
import { readEnvironment } from '../../../config/environment';
const context = z
  .object({ correlationId: z.string().min(1).max(100), userId: z.string().uuid().optional() })
  .strict();
const access = z
  .object({
    number: z.string().regex(/^TE-[A-F0-9]{32}$/),
    token: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional(),
  })
  .strict();
async function handle<T>(run: () => Promise<T>): Promise<OrdersResult<T>> {
  try {
    return { ok: true, value: await run() };
  } catch (error) {
    return {
      ok: false,
      error: {
        code:
          error instanceof PaymentError || error instanceof PaymentProviderError
            ? error.code
            : 'PAYMENTS_UNAVAILABLE',
        message: 'Payment request could not be completed',
        statusCode:
          error instanceof PaymentError
            ? error.statusCode
            : error instanceof PaymentProviderError
              ? 400
              : 503,
      },
    };
  }
}
@Controller()
export class PaymentsRpcController {
  constructor(
    @Inject(SimulatePayment) private readonly simulation: SimulatePayment,
    @Inject(GetPayment) private readonly get: GetPayment,
    @Inject(RecordWebhook) private readonly webhook: RecordWebhook,
  ) {}
  private getPayment(raw: unknown, checkout: boolean) {
    return handle(async () => {
      const parsed = z.object({ input: access, context }).strict().safeParse(raw);
      if (!parsed.success) throw new PaymentError('INVALID_INPUT', 400);
      return this.get.execute(parsed.data, checkout);
    });
  }
  @MessagePattern(PAYMENTS_PATTERNS.checkout) checkout(@Payload() raw: unknown) {
    return this.getPayment(raw, true);
  }
  @MessagePattern(PAYMENTS_PATTERNS.status) status(@Payload() raw: unknown) {
    return this.getPayment(raw, false);
  }
  @MessagePattern(PAYMENTS_PATTERNS.simulate) simulate(@Payload() raw: unknown) {
    return handle(async () => {
      const parsed = z
        .object({
          input: access.extend({ outcome: z.enum(['SUCCEEDED', 'FAILED']) }).strict(),
          context,
        })
        .strict()
        .safeParse(raw);
      if (!parsed.success) throw new PaymentError('INVALID_INPUT', 400);
      return this.simulation.execute(
        {
          input: { number: parsed.data.input.number, token: parsed.data.input.token },
          context: parsed.data.context,
        },
        parsed.data.input.outcome,
      );
    });
  }
  @MessagePattern(PAYMENTS_PATTERNS.webhook) receive(@Payload() raw: unknown) {
    return handle(async () => {
      const parsed = z
        .object({
          input: z
            .object({
              provider: z.enum(['fake', 'liqpay']),
              data: z.string().max(65536),
              signature: z.string().max(128),
            })
            .strict(),
          context,
        })
        .strict()
        .safeParse(raw);
      if (!parsed.success) throw new PaymentError('INVALID_INPUT', 400);
      if (parsed.data.input.provider !== readEnvironment().PAYMENT_PROVIDER)
        throw new PaymentError('PROVIDER_NOT_ACTIVE', 404);
      return this.webhook.execute(
        { data: parsed.data.input.data, signature: parsed.data.input.signature },
        parsed.data.context.correlationId,
      );
    });
  }
}
