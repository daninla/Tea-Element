import type {
  CartItemInput,
  CartQuote,
  CreateOrderInput,
  CreatedOrder,
  OrderView,
  PublicUser,
} from '@tea/contracts';
export class OrdersApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}
const base = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
export async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  key?: string,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    credentials: 'include',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new OrdersApiError(response.status, String(error.code ?? 'UNAVAILABLE'));
  }
  return response.json() as Promise<T>;
}
export const ordersApi = {
  quote: (items: CartItemInput[]) => request<CartQuote>('/cart/quote', 'POST', { items }),
  create: (order: CreateOrderInput, key: string, authenticated = false) =>
    request<CreatedOrder>(authenticated ? '/orders' : '/orders/guest', 'POST', order, key),
  get: (number: string, token?: string) =>
    request<OrderView>(
      `/orders/${encodeURIComponent(number)}${token ? `?token=${encodeURIComponent(token)}` : ''}`,
    ),
  cancel: (number: string, token?: string) =>
    request<OrderView>(
      `/orders/${encodeURIComponent(number)}/cancel${token ? `?token=${encodeURIComponent(token)}` : ''}`,
      'POST',
      {},
    ),
  me: async () => {
    try {
      return await request<PublicUser>('/auth/me');
    } catch (e) {
      if (e instanceof OrdersApiError && e.status === 401) return null;
      throw e;
    }
  },
  cart: () => request<CartItemInput[]>('/cart'),
  save: (items: CartItemInput[]) => request<CartItemInput[]>('/cart', 'PUT', { items }),
  merge: (items: CartItemInput[], key: string) =>
    request<CartItemInput[]>('/cart/merge', 'POST', { items }, key),
};
