import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { AUTH_PATTERNS, type AuthRequest, type RpcResult } from '@tea/contracts';
import { Register } from '../application/register';
import { Login } from '../application/login';
import { Refresh } from '../application/refresh';
import { Logout } from '../application/logout';
import { GetCurrentUser } from '../application/get-current-user';
import { AuthError } from '../domain/auth-error';
const context = z
  .object({
    correlationId: z.string().min(1).max(100),
    userAgent: z.string().max(256).optional(),
    ip: z.string().max(64).optional(),
  })
  .strict();
const email = z.string().email().max(320);
const password = z.string().min(8).max(128);
const login = z.object({ email, password }).strict();
const register = login.extend({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z
    .string()
    .regex(/^\+380\d{9}$/)
    .optional(),
  marketingConsent: z.boolean().optional(),
});
async function handle<T, R>(
  raw: unknown,
  input: z.ZodType<T>,
  execute: (request: AuthRequest<T>) => Promise<R>,
): Promise<RpcResult<R>> {
  const parsed = z.object({ input, context }).strict().safeParse(raw);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
    };
  try {
    return { ok: true, value: await execute(parsed.data as AuthRequest<T>) };
  } catch (error) {
    if (error instanceof AuthError)
      return {
        ok: false,
        error: { code: error.code, message: error.message, statusCode: error.statusCode },
      };
    return {
      ok: false,
      error: {
        code: 'AUTH_UNAVAILABLE',
        message: 'Authentication temporarily unavailable',
        statusCode: 503,
      },
    };
  }
}
@Controller()
export class AuthRpcController {
  constructor(
    @Inject(Register) private readonly register: Register,
    @Inject(Login) private readonly login: Login,
    @Inject(Refresh) private readonly refresh: Refresh,
    @Inject(Logout) private readonly logout: Logout,
    @Inject(GetCurrentUser) private readonly me: GetCurrentUser,
  ) {}
  @MessagePattern(AUTH_PATTERNS.register)
  registerUser(@Payload() data: unknown) {
    return handle(data, register, (r) => this.register.execute(r));
  }
  @MessagePattern(AUTH_PATTERNS.login)
  loginUser(@Payload() data: unknown) {
    return handle(data, login, (r) => this.login.execute(r));
  }
  @MessagePattern(AUTH_PATTERNS.refresh)
  refreshSession(@Payload() data: unknown) {
    return handle(data, z.object({ token: z.string().min(32).max(256) }).strict(), (r) =>
      this.refresh.execute(r),
    );
  }
  @MessagePattern(AUTH_PATTERNS.logout)
  logoutSession(@Payload() data: unknown) {
    return handle(data, z.object({ token: z.string().max(256) }).strict(), (r) =>
      this.logout.execute(r),
    );
  }
  @MessagePattern(AUTH_PATTERNS.me)
  currentUser(@Payload() data: unknown) {
    return handle(data, z.object({ userId: z.string().uuid() }).strict(), (r) =>
      this.me.execute(r),
    );
  }
}
