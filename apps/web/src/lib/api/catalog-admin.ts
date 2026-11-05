import type {
  AdminProduct,
  AdminCategory,
  AdminProductInput,
  CategoryInput,
  AdminProductPage,
  AdminCategoryPage,
  CatalogAuditPage,
  MediaAssetView,
} from '@tea/contracts';
import { request } from './orders';
export const catalogAdminApi = {
  products: (query: string) => request<AdminProductPage>('/admin/products?' + query),
  product: (id: string) => request<AdminProduct>('/admin/products/' + id),
  categories: (query: string) => request<AdminCategoryPage>('/admin/categories?' + query),
  audit: (id: string, page: number) =>
    request<CatalogAuditPage>(`/admin/catalog/${id}/audit?page=${page}`),
  saveProduct: (input: AdminProductInput, key: string, current?: AdminProduct) =>
    request<AdminProduct>(
      '/admin/products' + (current ? '/' + current.id : ''),
      current ? 'PATCH' : 'POST',
      current ? { input, expectedRevision: current.revision } : input,
      key,
    ),
  saveCategory: (input: CategoryInput, key: string, current?: AdminCategory) =>
    request<AdminCategory>(
      '/admin/categories' + (current ? '/' + current.id : ''),
      current ? 'PATCH' : 'POST',
      current ? { input, expectedRevision: current.revision } : input,
      key,
    ),
  upload: (file: File) => {
    const data = new FormData();
    data.set('file', file);
    return request<MediaAssetView>('/admin/media', 'POST', data);
  },
};
