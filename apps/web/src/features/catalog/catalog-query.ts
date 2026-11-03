import { z } from 'zod';
import { CATALOG_SORTS, CATALOG_SECTIONS, type CatalogQuery } from '@tea/contracts';
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).max(max).optional(),
  );
function boundedInteger(min: number, max: number) {
  return z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(min).max(max)).optional(),
  );
}
const boolean = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
);
const amount = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^\d+(?:[.,]\d{1,2})?$/)
    .transform((value) => {
      const [whole, decimal = ''] = value.replace(',', '.').split('.');
      return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    })
    .pipe(z.number().int().min(0).max(2147483647))
    .optional(),
);
const schema = z
  .object({
    section: z.enum(CATALOG_SECTIONS).optional(),
    category: optionalText(160).pipe(
      z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .optional(),
    ),
    q: optionalText(100),
    origin: optionalText(150),
    minPrice: amount,
    maxPrice: amount,
    onSale: boolean,
    inStock: boolean,
    sort: z.preprocess(
      (value) => (value === '' ? undefined : value),
      z.enum(CATALOG_SORTS).optional(),
    ),
    page: boundedInteger(1, 10000),
    pageSize: boundedInteger(1, 48),
  })
  .strict()
  .refine((q) => q.minPrice === undefined || q.maxPrice === undefined || q.minPrice <= q.maxPrice);
export type RawCatalogQuery = Record<string, string | string[] | undefined>;
export function parseCatalogQuery(raw: RawCatalogQuery, category?: string) {
  return schema.safeParse({ ...raw, ...(category ? { category } : {}) });
}
export function catalogHref(query: CatalogQuery, page = query.page ?? 1) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, page })) {
    if (
      value === undefined ||
      value === '' ||
      (key === 'category' && query.section !== 'EQUIPMENT') ||
      (key === 'section' && value !== 'ALL') ||
      (key === 'page' && value === 1)
    )
      continue;
    params.set(key, String(key === 'minPrice' || key === 'maxPrice' ? Number(value) / 100 : value));
  }
  const search = params.toString();
  const base =
    query.section === 'EQUIPMENT'
      ? '/teaware'
      : query.category
        ? `/catalog/${encodeURIComponent(query.category)}`
        : '/catalog';
  return `${base}${search ? `?${search}` : ''}`;
}
