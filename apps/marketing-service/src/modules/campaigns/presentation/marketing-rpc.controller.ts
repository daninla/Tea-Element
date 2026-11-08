import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { MARKETING_PATTERNS, type OrdersResult } from '@tea/contracts';
import { UnsubscribeMarketing } from '../application/unsubscribe-marketing';
@Controller()
export class MarketingRpcController {
  constructor(@Inject(UnsubscribeMarketing) private readonly unsubscribe: UnsubscribeMarketing) {}
  @MessagePattern(MARKETING_PATTERNS.unsubscribe) async execute(
    @Payload() raw: unknown,
  ): Promise<OrdersResult<{ unsubscribed: true }>> {
    const parsed = z
      .object({
        input: z
          .object({
            token: z
              .string()
              .regex(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/),
          })
          .strict(),
        context: z.object({ correlationId: z.string().min(1).max(100) }).strict(),
      })
      .strict()
      .safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid unsubscribe link', statusCode: 400 },
      };
    try {
      await this.unsubscribe.execute(parsed.data.input.token);
      return { ok: true, value: { unsubscribed: true } };
    } catch (e) {
      return {
        ok: false,
        error: {
          code:
            e instanceof Error && e.message === 'INVALID_TOKEN'
              ? 'INVALID_INPUT'
              : 'MARKETING_UNAVAILABLE',
          message: 'Unable to process unsubscribe request',
          statusCode: e instanceof Error && e.message === 'INVALID_TOKEN' ? 400 : 503,
        },
      };
    }
  }
}
