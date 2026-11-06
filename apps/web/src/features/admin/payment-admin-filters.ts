import { z } from 'zod';
import { PAYMENT_STATUSES, type AdminPaymentsRead } from '@tea/contracts';
import { localDay } from './order-filters';
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (x) =>
      Number.isFinite(new Date(x + 'T00:00:00').getTime()) &&
      localDay(new Date(x + 'T00:00:00')) === x,
  )
  .or(z.literal(''));
export const paymentFilterFields = z
  .object({
    q: z.string().trim().max(100),
    status: z.enum(['', ...PAYMENT_STATUSES]),
    provider: z.enum(['', 'FAKE', 'LIQPAY']),
    refundOnly: z.boolean(),
    from: day,
    to: day,
  })
  .refine((x) => !x.from || !x.to || x.from <= x.to);
export function parsePaymentFilters(
  p: URLSearchParams,
): Extract<AdminPaymentsRead, { kind: 'LIST' }> | null {
  if (
    [...p.keys()].some(
      (k) =>
        !['q', 'status', 'provider', 'refundOnly', 'from', 'to', 'page'].includes(k) ||
        p.getAll(k).length !== 1,
    )
  )
    return null;
  const b = p.get('refundOnly');
  if (b !== null && !['true', 'false'].includes(b)) return null;
  const page = Number(p.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) return null;
  const x = paymentFilterFields.safeParse({
    q: p.get('q') ?? '',
    status: p.get('status') ?? '',
    provider: p.get('provider') ?? '',
    refundOnly: b === 'true',
    from: p.get('from') ?? '',
    to: p.get('to') ?? '',
  });
  if (!x.success) return null;
  const d = x.data,
    end = d.to ? new Date(d.to + 'T00:00:00') : undefined;
  end?.setDate(end.getDate() + 1);
  return {
    kind: 'LIST',
    page,
    ...(d.q ? { q: d.q } : {}),
    ...(d.status ? { status: d.status } : {}),
    ...(d.provider ? { provider: d.provider } : {}),
    ...(d.refundOnly ? { refundOnly: true } : {}),
    ...(d.from ? { from: new Date(d.from + 'T00:00:00').toISOString() } : {}),
    ...(end ? { to: end.toISOString() } : {}),
  };
}
export function paymentReturn(value: string | undefined) {
  return value &&
    /^\/admin\/payments(?:\?[^#\\]*)?$/.test(value) &&
    parsePaymentFilters(new URLSearchParams(value.split('?')[1] ?? ''))
    ? value
    : '/admin/payments';
}
export const reconciliationFields = z.object({
  reason: z.string().trim().min(3).max(500),
  confirmed: z.literal(true),
});
export function paymentMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('uk-UA', { style: 'currency', currency }).format(amount / 100);
  } catch {
    return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')} ${currency}`;
  }
}
