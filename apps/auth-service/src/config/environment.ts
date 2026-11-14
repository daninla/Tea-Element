import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
config({ path: resolve(__dirname, '../../.env') });

const schema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32),
  SMTP_URL: z.string().url().default('smtp://localhost:1025'),
  SMTP_FROM_ADDRESS: z.string().email(),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  ORDERS_RPC_QUEUE: z.string().default('orders.rpc'),
  AUTH_RPC_QUEUE: z.string().min(1).default('auth.rpc'),
  EVENTS_NAMESPACE: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default('tea'),
  RABBITMQ_URL: z.string().url().default('amqp://tea:tea_dev@localhost:5672'),
  DATABASE_URL: z.string().url().default('postgresql://auth:tea_dev_auth@localhost:5433/auth_db'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse({
    ...source,
    SMTP_FROM_ADDRESS:
      source.SMTP_FROM_ADDRESS ??
      (source.NODE_ENV === 'production' ? undefined : 'account@tea-element.test'),
    JWT_ACCESS_SECRET:
      source.JWT_ACCESS_SECRET ??
      (source.NODE_ENV === 'test' ? 'test-secret-only-do-not-use-in-production-12345' : undefined),
  });
}
