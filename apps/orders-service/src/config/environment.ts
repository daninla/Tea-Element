import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
config({ path: resolve(__dirname, '../../.env') });

const schema = z.object({
  ORDER_ACCESS_SECRET: z.string().min(32),
  ORDERS_RPC_QUEUE: z.string().default('orders.rpc'),
  CATALOG_RPC_QUEUE: z.string().default('catalog.rpc'),
  EVENTS_NAMESPACE: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default('tea'),
  RABBITMQ_URL: z.string().url().default('amqp://tea:tea_dev@localhost:5672'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://orders:tea_dev_orders@localhost:5433/orders_db'),
  SMTP_URL: z.string().url().default('smtp://localhost:1025'),
  SMTP_FROM_ADDRESS: z.string().email(),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4003),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse({
    ...source,
    SMTP_FROM_ADDRESS:
      source.SMTP_FROM_ADDRESS ??
      (source.NODE_ENV === 'production' ? undefined : 'orders@tea-element.test'),
    ORDER_ACCESS_SECRET:
      source.ORDER_ACCESS_SECRET ??
      (source.NODE_ENV === 'test' ? 'test-only-order-secret-12345678901234567890' : undefined),
  });
}
