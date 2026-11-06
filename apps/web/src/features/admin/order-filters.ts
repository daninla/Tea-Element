import { customerDetailReturn } from './customer-filters';
import { z } from 'zod';
import { ORDER_STATUSES, type AdminOrderFilters } from '@tea/contracts';
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (x) =>
      !Number.isNaN(new Date(x + 'T00:00:00').getTime()) &&
      localDay(new Date(x + 'T00:00:00')) === x,
  );
const optionalDay = day.or(z.literal(''));
export const orderFilterFields = z
  .object({
    q: z.string().trim().max(100),
    status: z.enum(['', ...ORDER_STATUSES]),
    paymentMethod: z.enum(['', 'CASH_ON_DELIVERY', 'ONLINE_CARD']),
    customerType: z.enum(['', 'GUEST', 'ACCOUNT']),
    from: optionalDay,
    to: optionalDay,
  })
  .refine((x) => !x.from || !x.to || x.from <= x.to, { path: ['to'], message: 'range' });
export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseOrderFilters(params: URLSearchParams): AdminOrderFilters | null {
  const fields = Object.fromEntries(
    ['q', 'status', 'paymentMethod', 'customerType', 'from', 'to'].map((key) => [
      key,
      params.get(key) ?? '',
    ]),
  );
  const parsed = orderFilterFields.safeParse(fields);
  const page = Number(params.get('page') ?? 1);
  if (!parsed.success || !Number.isInteger(page) || page < 1 || page > 10000) return null;
  const x = parsed.data;
  const end = x.to ? new Date(x.to + 'T00:00:00') : undefined;
  end?.setDate(end.getDate() + 1);
  return {
    page,
    ...(x.q ? { q: x.q } : {}),
    ...(x.status ? { status: x.status } : {}),
    ...(x.paymentMethod ? { paymentMethod: x.paymentMethod } : {}),
    ...(x.customerType ? { customerType: x.customerType } : {}),
    ...(x.from ? { from: new Date(x.from + 'T00:00:00').toISOString() } : {}),
    ...(end ? { to: end.toISOString() } : {}),
  };
}

export function adminOrdersReturn(value: string | undefined) {
  const customer = customerDetailReturn(value);
  if (customer) return customer;
  if (!value || !/^\/admin\/orders(?:\?[^#\\]*)?$/.test(value)) return '/admin/orders';
  const query = value.includes('?') ? value.slice(value.indexOf('?') + 1) : '';
  return parseOrderFilters(new URLSearchParams(query)) ? value : '/admin/orders';
}
