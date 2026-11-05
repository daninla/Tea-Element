import { z } from 'zod';
export const inventoryContext = z
  .object({
    userId: z.string().uuid(),
    role: z.literal('ADMIN'),
    correlationId: z.string().min(1).max(100),
  })
  .strict();
export const inventoryFilters = z
  .object({
    page: z.number().int().min(1).max(10000),
    q: z.string().trim().max(100).optional(),
    section: z.enum(['ALL', 'TEA', 'EQUIPMENT']).optional(),
    lowStock: z.boolean().optional(),
  })
  .strict();
const reason = z.string().trim().min(3).max(500);
export const purchaseInput = z
  .object({
    productId: z.string().uuid(),
    key: z.string().uuid(),
    quantity: z.number().int().min(1).max(100000000),
    purchasePriceTotal: z.number().int().min(0).max(2147483647),
    supplier: z.string().trim().min(1).max(200),
    purchasedAt: z.string().datetime(),
    note: reason,
  })
  .strict();
export const adjustmentInput = z
  .object({
    productId: z.string().uuid(),
    key: z.string().uuid(),
    delta: z
      .number()
      .int()
      .min(-100000000)
      .max(100000000)
      .refine((x) => x !== 0),
    expectedStock: z.number().int().min(0).max(2147483647),
    kind: z.enum(['ADJUSTMENT', 'WRITE_OFF']),
    reason,
  })
  .strict()
  .refine((x) => x.kind !== 'WRITE_OFF' || x.delta < 0);
