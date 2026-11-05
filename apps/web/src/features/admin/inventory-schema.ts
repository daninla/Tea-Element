import { z } from 'zod';
import { localDay } from './order-filters';
export const inventoryFilters = z.object({
  q: z.string().trim().max(100),
  section: z.enum(['ALL', 'TEA', 'EQUIPMENT']),
  lowStock: z.boolean(),
  page: z.number().int().min(1).max(10000),
});
const quantity = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(100000000));
export const purchaseFields = z.object({
  quantity,
  price: z
    .string()
    .regex(/^\d+(?:[.,]\d{1,2})?$/)
    .transform((value) => {
      const [whole, decimal = ''] = value.replace(',', '.').split('.');
      return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
    })
    .pipe(z.number().int().min(0).max(2147483647)),
  supplier: z.string().trim().min(1).max(200),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (x) =>
        Number.isFinite(new Date(x + 'T00:00:00').getTime()) &&
        localDay(new Date(x + 'T00:00:00')) === x &&
        x <= localDay(new Date()),
    ),
  note: z.string().trim().min(3).max(500),
  confirmed: z.literal(true),
});
export const adjustmentFields = z.object({
  quantity,
  operation: z.enum(['INCREASE', 'DECREASE', 'WRITE_OFF']),
  reason: z.string().trim().min(3).max(500),
  confirmed: z.literal(true),
});
export function parseInventoryFilters(params: URLSearchParams) {
  const low = params.get('lowStock');
  if (low !== null && !['true', 'false'].includes(low)) return null;
  const result = inventoryFilters.safeParse({
    q: params.get('q') ?? '',
    section: params.get('section') ?? 'ALL',
    lowStock: low === 'true',
    page: Number(params.get('page') ?? 1),
  });
  return result.success ? result.data : null;
}
export function inventoryReturn(value: string | undefined) {
  if (!value || !/^\/admin\/inventory(?:\?[^#\\]*)?$/.test(value)) return '/admin/inventory';
  return parseInventoryFilters(new URLSearchParams(value.split('?')[1] ?? ''))
    ? value
    : '/admin/inventory';
}
