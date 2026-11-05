import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
config({ path: resolve(__dirname, '../../.env') });

const schema = z.object({
  CATALOG_MEDIA_DIR: z.string().min(1).default(resolve(__dirname, '../../var/catalog-media')),
  EVENTS_NAMESPACE: z
    .string()
    .regex(/^[a-z0-9.-]+$/)
    .default('tea'),
  CATALOG_RPC_QUEUE: z.string().min(1).default('catalog.rpc'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://catalog:tea_dev_catalog@localhost:5433/catalog_db'),
  RABBITMQ_URL: z.string().url().default('amqp://tea:tea_dev@localhost:5672'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4002),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse(source);
}
