import type { AdminOrderPage } from './administration';
export const ADMIN_CUSTOMERS_PATTERNS = {
  accounts: 'admin.customers.accounts',
  orders: 'admin.customers.orders',
} as const;
export interface CustomerFilters {
  page: number;
  q?: string;
}
export type AccountCustomerQuery =
  { kind: 'LIST'; page: number; q?: string } | { kind: 'DETAIL'; id: string };
export interface CustomerAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  marketingConsentAt: string | null;
  createdAt: string;
}
export interface CustomerAccountPage {
  items: CustomerAccount[];
  page: number;
  total: number;
  totalPages: number;
}
export type CustomerSelector = { kind: 'ACCOUNT'; id: string } | { kind: 'GUEST'; email: string };
export type OrderCustomerQuery =
  | { kind: 'GUESTS'; page: number; q?: string }
  | { kind: 'HISTORY'; customer: CustomerSelector; page: number };
export interface GuestCustomer {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  orderCount: number;
  completedTotal: number;
  lastOrderAt: string;
}
export interface GuestCustomerPage {
  items: GuestCustomer[];
  page: number;
  total: number;
  totalPages: number;
}
export interface CustomerHistory {
  orders: AdminOrderPage;
  summary: {
    orderCount: number;
    completedCount: number;
    completedTotal: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    contact: { firstName: string; lastName: string; email: string; phone: string } | null;
  };
  products: {
    productId: string;
    name: string;
    unit: 'GRAM' | 'PIECE';
    quantity: number;
    revenue: number;
  }[];
}
