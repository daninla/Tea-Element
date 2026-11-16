import { z } from 'zod';
import { DELIVERY_CARRIERS } from '@tea/contracts';
const carrier = z.enum(DELIVERY_CARRIERS);
const selection = z
  .object({ carrier, cityId: z.string().min(1).max(64), pointId: z.string().min(1).max(64) })
  .strict();
const paymentMethod = z.enum(['CASH_ON_DELIVERY', 'ONLINE_CARD']);
export const cartItems = z
  .array(
    z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }).strict(),
  )
  .max(50)
  .refine((items) => new Set(items.map((x) => x.variantId)).size === items.length);
export const deliveryRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CARRIERS') }).strict(),
  z.object({ kind: z.literal('REGIONS'), carrier: z.literal('UKRPOSHTA') }).strict(),
  z
    .object({
      kind: z.literal('CITIES'),
      carrier,
      query: z.string().trim().min(2).max(100),
      regionId: z
        .string()
        .regex(/^\d{1,12}$/)
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('POINTS'),
      carrier,
      cityId: z.string().min(1).max(64),
      query: z.string().trim().max(100).optional(),
      page: z.number().int().min(1).max(100).optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('QUOTE'),
      selection,
      items: cartItems.refine((x) => x.length > 0),
      paymentMethod,
    })
    .strict(),
]);
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
        method: z.enum(['NOVA_POSHTA_BRANCH', 'NOVA_POSHTA_COURIER', 'PICKUP', 'CARRIER_POINT']),
        city: z.string().trim().max(100),
        address: z.string().trim().max(300),
        selection: selection.optional(),
      })
      .strict()
      .refine((x) =>
        x.method === 'CARRIER_POINT'
          ? !!x.selection
          : !x.selection &&
            (x.method === 'PICKUP' || (x.city.length >= 2 && x.address.length >= 2)),
      ),
    paymentMethod,
    expectedDeliveryTotal: z.number().int().min(0).max(2147483647).optional(),
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
