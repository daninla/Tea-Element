import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import {
  MARKETING_PATTERNS,
  MARKETING_CAMPAIGNS,
  EMAIL_STATUSES,
  type OrdersResult,
} from '@tea/contracts';
import { ReadCampaignAdmin } from '../application/read-campaign-admin';
import { ConfigureCampaign } from '../application/configure-campaign';
const context = z
  .object({
    userId: z.string().uuid(),
    role: z.literal('ADMIN'),
    correlationId: z.string().min(1).max(100),
  })
  .strict();
const read = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SETTINGS') }).strict(),
  z
    .object({
      kind: z.literal('LOGS'),
      page: z.number().int().min(1).max(10000),
      q: z.string().trim().max(100).optional(),
      campaign: z.enum(MARKETING_CAMPAIGNS).optional(),
      status: z.enum(EMAIL_STATUSES).optional(),
    })
    .strict(),
]);
const configure = z
  .object({
    campaign: z.enum(MARKETING_CAMPAIGNS),
    enabled: z.boolean(),
    expectedRevision: z.number().int().min(0).max(2147483646),
    key: z.string().uuid(),
  })
  .strict();
async function handle<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  run: (input: T, actorId: string) => Promise<unknown>,
): Promise<OrdersResult<unknown>> {
  const envelope = z.object({ context, input: z.unknown() }).strict().safeParse(raw);
  if (!envelope.success)
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
    };
  const parsed = schema.safeParse(envelope.data.input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
    };
  try {
    return { ok: true, value: await run(parsed.data, envelope.data.context.userId) };
  } catch (e) {
    const conflict =
      e instanceof Error && ['IDEMPOTENCY_CONFLICT', 'CAMPAIGN_STATE_CONFLICT'].includes(e.message);
    return {
      ok: false,
      error: {
        code: conflict ? (e as Error).message : 'MARKETING_UNAVAILABLE',
        message: conflict ? 'Reload campaign settings' : 'Marketing unavailable',
        statusCode: conflict ? 409 : 503,
      },
    };
  }
}
@Controller()
export class AdminCampaignsRpcController {
  constructor(
    @Inject(ReadCampaignAdmin) private readonly read: ReadCampaignAdmin,
    @Inject(ConfigureCampaign) private readonly configure: ConfigureCampaign,
  ) {}
  @MessagePattern(MARKETING_PATTERNS.adminRead) get(@Payload() raw: unknown) {
    return handle(raw, read, (x) => this.read.execute(x));
  }
  @MessagePattern(MARKETING_PATTERNS.configure) write(@Payload() raw: unknown) {
    return handle(raw, configure, (x, actor) => this.configure.execute(x, actor));
  }
}
