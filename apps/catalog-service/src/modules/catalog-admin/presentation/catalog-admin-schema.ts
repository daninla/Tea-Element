import { z } from 'zod';
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const unit = z.enum(['TEA', 'EQUIPMENT']);
const page = z.number().int().min(1).max(10000);
export const categoryInput = z
  .object({
    slug: slug.max(100),
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(5000),
    section: unit,
    sortOrder: z.number().int().min(0).max(100000),
    isActive: z.boolean(),
  })
  .strict();
export const productInput = z
  .object({
    slug: slug.max(160),
    name: z.string().trim().min(1).max(200),
    nameOriginal: z.string().trim().max(200),
    description: z.string().trim().min(3).max(20000),
    origin: z.string().trim().max(150),
    year: z.number().int().min(1900).max(2100).nullable(),
    categoryId: z.string().uuid(),
    isActive: z.boolean(),
    images: z
      .array(z.string().max(200))
      .max(10)
      .refine((x) => new Set(x).size === x.length),
    tags: z.array(z.string().trim().min(1).max(50)).max(20),
    brewingGuide: z
      .object({
        temperatureCelsius: z.number().int().min(1).max(100),
        seconds: z.number().int().min(1).max(3600),
        infusions: z.number().int().min(1).max(50),
      })
      .strict()
      .nullable(),
    variants: z
      .array(
        z
          .object({
            id: z.string().uuid().optional(),
            sku: z.string().trim().min(1).max(100),
            weightGrams: z.number().int().min(1).max(100000).nullable(),
            price: z.number().int().min(1).max(2147483647),
            isActive: z.boolean(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export const promotionInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.number().int().min(1).max(2147483647),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    isActive: z.boolean(),
    targets: z
      .array(z.object({ kind: z.enum(['PRODUCT', 'CATEGORY']), id: z.string().uuid() }).strict())
      .min(1)
      .max(50),
  })
  .strict();
export const adminRead = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('PRODUCTS'),
      page,
      q: z.string().trim().max(100).optional(),
      section: unit.optional(),
      active: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('PRODUCT'), id: z.string().uuid() }).strict(),
  z
    .object({
      kind: z.literal('CATEGORIES'),
      page,
      pageSize: z.number().int().min(1).max(100).optional(),
      q: z.string().trim().max(100).optional(),
      section: unit.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('PROMOTIONS'),
      page,
      q: z.string().trim().max(100).optional(),
      active: z.boolean().optional(),
    })
    .strict(),
  z.object({ kind: z.literal('PROMOTION'), id: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('AUDIT'), id: z.string().uuid(), page }).strict(),
]);
const key = z.string().uuid(),
  id = z.string().uuid(),
  expectedRevision = z.number().int().min(0).max(2147483646);
export const adminWrite = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CREATE_PROMOTION'), input: promotionInput, key }).strict(),
  z
    .object({
      kind: z.literal('UPDATE_PROMOTION'),
      id,
      expectedRevision,
      input: promotionInput,
      key,
    })
    .strict(),
  z.object({ kind: z.literal('CREATE_PRODUCT'), input: productInput, key }).strict(),
  z
    .object({ kind: z.literal('UPDATE_PRODUCT'), id, expectedRevision, input: productInput, key })
    .strict(),
  z.object({ kind: z.literal('CREATE_CATEGORY'), input: categoryInput, key }).strict(),
  z
    .object({ kind: z.literal('UPDATE_CATEGORY'), id, expectedRevision, input: categoryInput, key })
    .strict(),
]);
