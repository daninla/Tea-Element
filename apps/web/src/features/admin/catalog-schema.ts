import { z } from 'zod';
export const catalogPrice = z
  .string()
  .regex(/^\d+(?:[.,]\d{1,2})?$/)
  .transform((x) => {
    const [w, d = ''] = x.replace(',', '.').split('.');
    return Number(w) * 100 + Number(d.padEnd(2, '0'));
  })
  .pipe(z.number().int().min(1).max(2147483647));
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const categoryFields = z.object({
  slug: slug.max(100),
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000),
  section: z.enum(['TEA', 'EQUIPMENT']),
  sortOrder: z.coerce.number().int().min(0).max(100000),
  isActive: z.boolean(),
});
export const productFields = z
  .object({
    slug: slug.max(160),
    name: z.string().trim().min(1).max(200),
    nameOriginal: z.string().trim().max(200),
    description: z.string().trim().min(3).max(20000),
    origin: z.string().trim().max(150),
    year: z
      .string()
      .transform((x) => (x === '' ? null : Number(x)))
      .pipe(z.number().int().min(1900).max(2100).nullable()),
    categoryId: z.string().uuid(),
    isActive: z.boolean(),
    tags: z
      .string()
      .transform((x) =>
        x
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.string().min(1).max(50)).max(20)),
    images: z.array(z.string()).max(10),
    brewingEnabled: z.boolean(),
    temperature: z.string(),
    seconds: z.string(),
    infusions: z.string(),
    variants: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          sku: z.string().trim().min(1).max(100),
          weight: z
            .string()
            .transform((x) => (x === '' ? null : Number(x)))
            .pipe(z.number().int().min(1).max(100000).nullable()),
          price: catalogPrice,
          isActive: z.boolean(),
        }),
      )
      .min(1)
      .max(20),
  })
  .superRefine((x, c) => {
    if (
      x.brewingEnabled &&
      ![
        [x.temperature, 1, 100],
        [x.seconds, 1, 3600],
        [x.infusions, 1, 50],
      ].every(
        ([v, min, max]) =>
          /^\d+$/.test(String(v)) && Number(v) >= Number(min) && Number(v) <= Number(max),
      )
    )
      c.addIssue({ code: 'custom', path: ['temperature'], message: 'brewing' });
  });
export function parseCatalogFilters(p: URLSearchParams) {
  const r = z
    .object({
      page: z.number().int().min(1).max(10000),
      q: z.string().max(100),
      section: z.enum(['', 'TEA', 'EQUIPMENT']),
      active: z.enum(['', 'true', 'false']),
    })
    .safeParse({
      page: Number(p.get('page') ?? 1),
      q: p.get('q') ?? '',
      section: p.get('section') ?? '',
      active: p.get('active') ?? '',
    });
  return r.success ? r.data : null;
}
