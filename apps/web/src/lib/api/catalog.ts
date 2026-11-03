import type { CatalogQuery, CategoryView, ProductPage, ProductView } from '@tea/contracts';
export class GatewayError extends Error {
  constructor(public readonly status: number) {
    super('Gateway request failed');
  }
}
function baseUrl() {
  if (typeof window === 'undefined')
    return `${(process.env.INTERNAL_API_URL ?? 'http://localhost:4000').replace(/\/$/, '')}/api/v1`;
  return (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
}
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    cache: 'no-store',
    credentials: 'omit',
    signal: signal ?? AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new GatewayError(response.status);
  return response.json() as Promise<T>;
}
export const catalogApi = {
  categories: (signal?: AbortSignal) => get<CategoryView[]>('/categories', signal),
  products: (query: CatalogQuery = {}, signal?: AbortSignal) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== '') params.set(key, String(value));
    return get<ProductPage>(`/products?${params}`, signal);
  },
  product: (slug: string, signal?: AbortSignal) =>
    get<ProductView>(`/products/${encodeURIComponent(slug)}`, signal),
};
