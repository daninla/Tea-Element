import { z } from 'zod';
export const cartItems = z
  .array(
    z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }).strict(),
  )
  .max(50)
  .refine((items) => new Set(items.map((x) => x.variantId)).size === items.length);
export const createInput = z
  .object({
    items: cartItems.refine((x) => x.length > 0),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z.string().regex(/^\+380\d{9}$/),
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((x) => x.toLowerCase()),
    delivery: z
      .object({
        method: z.enum(['NOVA_POSHTA_BRANCH', 'NOVA_POSHTA_COURIER', 'PICKUP']),
        city: z.string().trim().max(100),
        address: z.string().trim().max(300),
      })
      .strict()
      .refine((x) => x.method === 'PICKUP' || (x.city.length >= 2 && x.address.length >= 2)),
    paymentMethod: z.literal('CASH_ON_DELIVERY'),
    comment: z.string().trim().max(1000).optional(),
    marketingConsent: z.boolean(),
    acceptTerms: z.literal(true),
  })
  .strict();
export const access = z
  .object({
    number: z.string().regex(/^TE-[A-F0-9]{32}$/),
    token: z
      .string()
      .regex(/^[A-Za-z0-9_-]{43}$/)
      .optional(),
  })
  .strict();
export const context = z
  .object({ correlationId: z.string().min(1).max(100), userId: z.string().uuid().optional() })
  .strict();
