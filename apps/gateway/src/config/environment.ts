import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
config({ path: resolve(__dirname, '../../.env') });

const schema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32),
  PAYMENTS_RPC_QUEUE: z.string().default('payments.rpc'),
  MARKETING_RPC_QUEUE: z.string().default('marketing.rpc'),
  ORDERS_RPC_QUEUE: z.string().default('orders.rpc'),
  AUTH_RPC_QUEUE: z.string().min(1).default('auth.rpc'),
  RABBITMQ_URL: z.string().url().default('amqp://tea:tea_dev@localhost:5672'),
  CATALOG_RPC_QUEUE: z.string().min(1).default('catalog.rpc'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse({
    ...source,
    JWT_ACCESS_SECRET:
      source.JWT_ACCESS_SECRET ??
      (source.NODE_ENV === 'test' ? 'test-secret-only-do-not-use-in-production-12345' : undefined),
  });
}
