import { z } from 'zod';
import { ORDER_STATUSES } from '@tea/contracts';
export const adminOrderFilters = z
  .object({
    page: z.number().int().min(1).max(10000),
    q: z.string().trim().max(100).optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    paymentMethod: z.enum(['CASH_ON_DELIVERY', 'ONLINE_CARD']).optional(),
    customerType: z.enum(['GUEST', 'ACCOUNT']).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict()
  .refine((x) => !x.from || !x.to || Date.parse(x.from) < Date.parse(x.to), {
    message: 'Invalid date range',
  });
export const adminContext = z
  .object({
    userId: z.string().uuid(),
    role: z.literal('ADMIN'),
    correlationId: z.string().min(1).max(100),
  })
  .strict();
