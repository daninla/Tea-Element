import type {
  InventoryFilters,
  InventoryPage,
  InventoryItem,
  InventoryHistory,
  InventoryCommandResult,
  PurchaseInput,
  AdjustmentInput,
} from '@tea/contracts';
import { request } from './orders';
export const inventoryApi = {
  list: (input: InventoryFilters) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(input))
      if (value !== undefined) params.set(key, String(value));
    return request<InventoryPage>('/admin/inventory?' + params);
  },
  get: (id: string) => request<InventoryItem>('/admin/inventory/' + encodeURIComponent(id)),
  history: (id: string, kind: 'MOVEMENTS' | 'PURCHASES', page: number) =>
    request<InventoryHistory>(
      `/admin/inventory/${kind === 'PURCHASES' ? 'purchases' : 'movements'}?productId=${encodeURIComponent(id)}&page=${page}`,
    ),
  purchase: ({ key, ...input }: PurchaseInput) =>
    request<InventoryCommandResult>('/admin/inventory/purchases', 'POST', input, key),
  adjust: ({ key, productId, ...input }: AdjustmentInput) =>
    request<InventoryCommandResult>(
      `/admin/inventory/${encodeURIComponent(productId)}/adjust`,
      'POST',
      input,
      key,
    ),
};
