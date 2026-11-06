import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { ADMIN_CUSTOMERS_PATTERNS, type RpcResult } from '@tea/contracts';
import { AuthError } from '../../auth/domain/auth-error';
import { ReadCustomerAccounts } from '../application/read-customer-accounts';
const input = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('LIST'),
      page: z.number().int().min(1).max(10000),
      q: z.string().trim().max(100).optional(),
    })
    .strict(),
  z.object({ kind: z.literal('DETAIL'), id: z.string().uuid() }).strict(),
]);
@Controller()
export class CustomerAccountsRpcController {
  constructor(@Inject(ReadCustomerAccounts) private readonly read: ReadCustomerAccounts) {}
  @MessagePattern(ADMIN_CUSTOMERS_PATTERNS.accounts) async execute(
    @Payload() raw: unknown,
  ): Promise<RpcResult<unknown>> {
    const envelope = z
      .object({
        input: z.unknown(),
        context: z
          .object({
            userId: z.string().uuid(),
            role: z.literal('ADMIN'),
            correlationId: z.string().min(1).max(100),
          })
          .strict(),
      })
      .strict()
      .safeParse(raw);
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
        value: await this.read.execute(parsed.data, envelope.data.context.userId),
      };
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof AuthError
            ? { code: e.code, message: e.message, statusCode: e.statusCode }
            : { code: 'AUTH_UNAVAILABLE', message: 'Customers unavailable', statusCode: 503 },
      };
    }
  }
}
