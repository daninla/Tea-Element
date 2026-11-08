import type { OrderView, OrderStatus } from './orders';
export const ADMIN_ORDERS_PATTERNS = {
  list: 'admin.orders.list',
  detail: 'admin.orders.detail',
  transition: 'admin.orders.transition',
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
  stockDeductedAt: string | null;
  actions: {
    actorId: string;
    fromStatus: OrderStatus;
    status: OrderStatus;
    reason: string;
    at: string;
  }[];
}

export interface AdminOrderTransition {
  id: string;
  status: 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  expectedStatus: OrderStatus;
  reason: string;
  key: string;
}

export const ADMIN_STOCK_PATTERN = 'admin.stock.movements';
export interface StockMovementView {
  id: string;
  productId: string;
  productName: string;
  orderId: string | null;
  type: string;
  unit: string;
  quantity: number;
  stockDelta: number;
  reservedDelta: number;
  createdAt: string;
}
export interface StockMovementPage {
  items: StockMovementView[];
  page: number;
  total: number;
  totalPages: number;
}
