import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';
config({ path: resolve(__dirname, '../../.env') });

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4004),
    CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    DATABASE_URL: z
      .string()
      .url()
      .default('postgresql://payments:tea_dev_payments@localhost:5433/payments_db'),
    RABBITMQ_URL: z.string().url().default('amqp://tea:tea_dev@localhost:5672'),
    EVENTS_NAMESPACE: z
      .string()
      .regex(/^[a-z0-9.-]+$/)
      .default('tea'),
    PAYMENTS_RPC_QUEUE: z.string().default('payments.rpc'),
    ORDERS_RPC_QUEUE: z.string().default('orders.rpc'),
    FAKE_PAYMENT_SECRET: z.string().min(32).optional(),
    PAYMENT_PROVIDER: z.enum(['fake', 'liqpay']).default('fake'),
    LIQPAY_PUBLIC_KEY: z.string().optional(),
    LIQPAY_PRIVATE_KEY: z.string().optional(),
    PAYMENT_CALLBACK_URL: z.string().url().max(510).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.PAYMENT_PROVIDER === 'fake' && env.NODE_ENV === 'production')
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['PAYMENT_PROVIDER'],
        message: 'Fake provider is development-only',
      });
    if (env.PAYMENT_PROVIDER === 'liqpay') {
      for (const key of ['LIQPAY_PUBLIC_KEY', 'LIQPAY_PRIVATE_KEY'] as const)
        if (!env[key]?.startsWith('sandbox_') || env[key]!.length <= 8)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'Sandbox credentials are required for this milestone',
          });
      for (const key of ['CORS_ORIGIN', 'PAYMENT_CALLBACK_URL'] as const) {
        const value = env[key];
        if (!value || !value.startsWith('https://'))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: 'HTTPS URL is required for LiqPay',
          });
      }
    }
  });
export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  return schema.parse(source);
}
