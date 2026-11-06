export const ADMIN_DASHBOARD_PATTERN = 'admin.orders.dashboard';
export type DashboardDays = 1 | 7 | 30;
export interface DashboardDay {
  day: string;
  createdOrders: number;
  unlinkedOrders: number;
  completedOrders: number;
  onlineRevenue: number;
  codRevenue: number;
}
export interface AdminDashboard {
  from: string;
  asOf: string;
  days: DashboardDays;
  createdOrders: number;
  unlinkedOrders: number;
  completedOrders: number;
  onlineRevenue: number;
  codRevenue: number;
  averageOrder: number;
  series: DashboardDay[];
  topProducts: {
    productId: string;
    name: string;
    unit: 'GRAM' | 'PIECE';
    quantity: number;
    revenue: number;
  }[];
}
