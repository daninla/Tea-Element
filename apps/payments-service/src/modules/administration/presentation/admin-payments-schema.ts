import { z } from 'zod';
import { PAYMENT_STATUSES } from '@tea/contracts';
export const adminPaymentContext = z
  .object({
    userId: z.string().uuid(),
    role: z.literal('ADMIN'),
    correlationId: z.string().min(1).max(100),
  })
  .strict();
const page = z.number().int().min(1).max(10000);
export const adminPaymentsRead = z
  .discriminatedUnion('kind', [
    z
      .object({
        kind: z.literal('LIST'),
        page,
        q: z.string().trim().max(100).optional(),
        status: z.enum(PAYMENT_STATUSES).optional(),
        provider: z.enum(['FAKE', 'LIQPAY']).optional(),
        refundOnly: z.boolean().optional(),
        from: z.string().datetime().optional(),
        to: z.string().datetime().optional(),
      })
      .strict(),
    z.object({ kind: z.literal('DETAIL'), id: z.string().uuid() }).strict(),
    z
      .object({
        kind: z.literal('EVENTS'),
        page,
        paymentId: z.string().uuid().optional(),
        signatureValid: z.boolean().optional(),
      })
      .strict(),
    z.object({ kind: z.literal('COMMANDS'), id: z.string().uuid(), page }).strict(),
  ])
  .refine((x) => x.kind !== 'LIST' || !x.from || !x.to || Date.parse(x.from) < Date.parse(x.to));
export const adminReconciliation = z
  .object({
    paymentId: z.string().uuid(),
    expectedStatus: z.enum(PAYMENT_STATUSES),
    reason: z.string().trim().min(3).max(500),
    key: z.string().uuid(),
  })
  .strict();
