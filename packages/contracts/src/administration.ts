import type { OrderView, OrderStatus } from './orders';
export const ADMIN_ORDERS_PATTERNS = {
  list: 'admin.orders.list',
  detail: 'admin.orders.detail',
} as const;
export interface AdminOrderFilters {
  page: number;
  q?: string;
  status?: OrderStatus;
  paymentMethod?: 'CASH_ON_DELIVERY' | 'ONLINE_CARD';
  customerType?: 'GUEST' | 'ACCOUNT';
  from?: string;
  to?: string;
}
export type AdminOrderSummary = Pick<
  OrderView,
  | 'id'
  | 'number'
  | 'status'
  | 'total'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'paymentMethod'
  | 'paymentStatus'
  | 'createdAt'
> & { userId: string | null };
export interface AdminOrderPage {
  items: AdminOrderSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface AdminOrderDetail extends OrderView {
  userId: string | null;
  comment: string;
}
