import type { AdminOrderFilters, AdminOrderPage, AdminOrderDetail } from '@tea/contracts';
import { request } from './orders';
export const adminApi = {
  orders: (filters: AdminOrderFilters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters))
      if (value !== undefined && value !== '') params.set(key, String(value));
    return request<AdminOrderPage>(`/admin/orders?${params}`);
  },
  order: (id: string) => request<AdminOrderDetail>(`/admin/orders/${encodeURIComponent(id)}`),
};
