import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { AUTH_PATTERNS, type RpcResult } from '@tea/contracts';
import { AuthError } from '../../auth/domain/auth-error';
import { RequestEmail } from '../application/request-email';
import { ConfirmEmail } from '../application/confirm-email';
import { ResetPassword } from '../application/reset-password';
import { UpdateProfile } from '../application/update-profile';
import { RegisterFromOrder } from '../application/register-from-order';
const context = z
  .object({
    correlationId: z.string().min(1).max(100),
    userAgent: z.string().max(256).optional(),
    ip: z.string().max(64).optional(),
  })
  .strict();
const token = z.string().max(100);
const delivery = z
  .object({
    method: z.enum(['PICKUP', 'NOVA_POSHTA_BRANCH', 'NOVA_POSHTA_COURIER']),
    city: z.string().trim().max(100),
    address: z.string().trim().max(300),
  })
  .strict()
  .refine((x) => x.method === 'PICKUP' || (x.city.length >= 2 && x.address.length >= 2));
async function handle<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  run: (input: T, correlationId: string) => Promise<unknown>,
): Promise<RpcResult<unknown>> {
  const parsed = z.object({ input: schema, context }).strict().safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
    };
  try {
    return {
      ok: true,
      value: await run(parsed.data.input as T, parsed.data.context.correlationId),
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof AuthError
          ? { code: e.code, message: e.message, statusCode: e.statusCode }
          : { code: 'AUTH_UNAVAILABLE', message: 'Account unavailable', statusCode: 503 },
    };
  }
}
@Controller()
export class AccountRpcController {
  constructor(
    @Inject(RequestEmail) private readonly request: RequestEmail,
    @Inject(ConfirmEmail) private readonly confirm: ConfirmEmail,
    @Inject(ResetPassword) private readonly reset: ResetPassword,
    @Inject(UpdateProfile) private readonly profile: UpdateProfile,
    @Inject(RegisterFromOrder) private readonly register: RegisterFromOrder,
  ) {}
  @MessagePattern(AUTH_PATTERNS.requestEmail) requestEmail(@Payload() raw: unknown) {
    return handle(raw, z.object({ userId: z.string().uuid() }).strict(), (x) =>
      this.request.execute('VERIFY_EMAIL', x),
    );
  }
  @MessagePattern(AUTH_PATTERNS.confirmEmail) confirmEmail(@Payload() raw: unknown) {
    return handle(raw, z.object({ token }).strict(), (x, c) => this.confirm.execute(x.token, c));
  }
  @MessagePattern(AUTH_PATTERNS.requestPassword) requestPassword(@Payload() raw: unknown) {
    return handle(raw, z.object({ email: z.string().trim().email().max(320) }).strict(), (x) =>
      this.request.execute('RESET_PASSWORD', x),
    );
  }
  @MessagePattern(AUTH_PATTERNS.resetPassword) resetPassword(@Payload() raw: unknown) {
    return handle(raw, z.object({ token, password: z.string().min(8).max(128) }).strict(), (x, c) =>
      this.reset.execute(x.token, x.password, c),
    );
  }
  @MessagePattern(AUTH_PATTERNS.profile) update(@Payload() raw: unknown) {
    return handle(
      raw,
      z
        .object({
          userId: z.string().uuid(),
          profile: z
            .object({
              firstName: z.string().trim().min(1).max(100),
              lastName: z.string().trim().min(1).max(100),
              phone: z
                .string()
                .regex(/^\+380\d{9}$/)
                .nullable(),
              defaultDelivery: delivery.nullable(),
            })
            .strict(),
        })
        .strict(),
      (x) => this.profile.execute(x.userId, x.profile),
    );
  }
  @MessagePattern(AUTH_PATTERNS.registerFromOrder) registerFromOrder(@Payload() raw: unknown) {
    return handle(
      raw,
      z
        .object({
          number: z.string().regex(/^TE-[A-F0-9]{32}$/),
          token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
          password: z.string().min(8).max(128),
          marketingConsent: z.boolean().optional(),
        })
        .strict(),
      async (x, c) => this.register.execute(x, { correlationId: c }),
    );
  }
}
