import { z } from 'zod';
export const customerFilters = z.object({
  kind: z.enum(['ACCOUNT', 'GUEST']),
  q: z.string().trim().max(100),
  page: z.number().int().min(1).max(10000),
});
export function parseCustomerFilters(p: URLSearchParams) {
  if ([...p.keys()].some((k) => !['kind', 'q', 'page'].includes(k) || p.getAll(k).length !== 1))
    return null;
  const x = customerFilters.safeParse({
    kind: p.get('kind') ?? 'ACCOUNT',
    q: p.get('q') ?? '',
    page: Number(p.get('page') ?? 1),
  });
  return x.success ? x.data : null;
}
export function customerReturn(value: string | undefined) {
  if (!value || !/^\/admin\/customers(?:\?[^#\\]*)?$/.test(value)) return '/admin/customers';
  return parseCustomerFilters(new URLSearchParams(value.split('?')[1] ?? ''))
    ? value
    : '/admin/customers';
}

export function customerDetailReturn(value: string | undefined) {
  if (
    !value ||
    !/^\/admin\/customers\/(?:accounts\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|guest)(?:\?[^#\\]*)?$/i.test(
      value,
    )
  )
    return null;
  const [path, query = ''] = value.split('?'),
    p = new URLSearchParams(query),
    allowed = path!.endsWith('/guest') ? ['email', 'page', 'returnTo'] : ['page', 'returnTo'];
  if ([...p.keys()].some((k) => !allowed.includes(k) || p.getAll(k).length !== 1)) return null;
  const page = Number(p.get('page') ?? 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) return null;
  if (
    path!.endsWith('/guest') &&
    !z.string().trim().email().max(320).safeParse(p.get('email')).success
  )
    return null;
  const back = p.get('returnTo');
  if (back !== null && customerReturn(back) !== back) return null;
  return value;
}
