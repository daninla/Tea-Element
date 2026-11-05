import type {
  StockMovementPage,
  AdminOrderFilters,
  AdminOrderPage,
  AdminOrderDetail,
  AdminOrderTransition,
} from '@tea/contracts';
import { request } from './orders';
export const adminApi = {
  movements: (id: string, page: number) =>
    request<StockMovementPage>(`/admin/orders/${encodeURIComponent(id)}/movements?page=${page}`),
  transition: ({ id, key, ...input }: AdminOrderTransition) =>
    request<AdminOrderDetail>(
      `/admin/orders/${encodeURIComponent(id)}/status`,
      'PATCH',
      input,
      key,
    ),
  orders: (filters: AdminOrderFilters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined && value !== '') params.set(key, String(value));
    return request<AdminOrderPage>(`/admin/orders?${params}`);
  },
  order: (id: string) => request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`),
};
