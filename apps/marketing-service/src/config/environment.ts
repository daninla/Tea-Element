import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
config({ path: resolve(__dirname, '../../.env') });

const schema = z.object({
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://marketing:tea_dev_marketing@localhost:5433/marketing_db'),
  RABBITMQ_URL: z.string().url().default('amqp://tea:tea_dev@localhost:5672'),
  MARKETING_RPC_QUEUE: z.string().default('marketing.rpc'),
  CATALOG_RPC_QUEUE: z.string().default('catalog.rpc'),
  EVENTS_NAMESPACE: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default('tea'),
  SMTP_URL: z.string().url().default('smtp://localhost:1025'),
  SMTP_FROM_ADDRESS: z.string().email(),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  MARKETING_UNSUBSCRIBE_SECRET: z.string().min(32),
  MARKETING_WINBACK_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((x) => x === 'true'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4005),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse({
    ...source,
    SMTP_FROM_ADDRESS:
      source.SMTP_FROM_ADDRESS ??
      (source.NODE_ENV === 'production' ? undefined : 'marketing@tea-element.test'),
    MARKETING_UNSUBSCRIBE_SECRET:
      source.MARKETING_UNSUBSCRIBE_SECRET ??
      (source.NODE_ENV === 'test'
        ? 'test-only-marketing-unsubscribe-secret-1234567890'
        : undefined),
  });
}
