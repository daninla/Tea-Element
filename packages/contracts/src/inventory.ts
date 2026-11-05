import type { StockMovementView } from './administration';
export const INVENTORY_PATTERNS = {
  list: 'admin.inventory.list',
  get: 'admin.inventory.get',
  history: 'admin.inventory.history',
  purchase: 'admin.inventory.purchase',
  adjust: 'admin.inventory.adjust',
} as const;
export interface InventoryFilters {
  page: number;
  q?: string;
  section?: 'TEA' | 'EQUIPMENT' | 'ALL';
  lowStock?: boolean;
}
export interface InventoryItem {
  productId: string;
  name: string;
  slug: string;
  category: string;
  active: boolean;
  unit: 'GRAM' | 'PIECE';
  stock: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
}
export interface InventoryPage {
  items: InventoryItem[];
  page: number;
  total: number;
  totalPages: number;
}
export interface PurchaseInput {
  productId: string;
  quantity: number;
  purchasePriceTotal: number;
  supplier: string;
  purchasedAt: string;
  note: string;
  key: string;
}
export interface AdjustmentInput {
  productId: string;
  delta: number;
  expectedStock: number;
  kind: 'ADJUSTMENT' | 'WRITE_OFF';
  reason: string;
  key: string;
}
export interface InventoryCommandResult {
  commandId: string;
  productId: string;
  unit: 'GRAM' | 'PIECE';
  stock: number;
  reserved: number;
  available: number;
  purchaseId: string | null;
  movementId: string;
}
export interface PurchaseView {
  id: string;
  productId: string;
  unit: 'GRAM' | 'PIECE';
  quantity: number;
  purchasePriceTotal: number;
  supplier: string;
  purchasedAt: string;
  note: string;
  actorId: string;
  createdAt: string;
}
export interface InventoryMovementView extends StockMovementView {
  actorId: string | null;
  referenceId: string | null;
  note: string;
}
export type InventoryHistory =
  | {
      kind: 'MOVEMENTS';
      items: InventoryMovementView[];
      page: number;
      total: number;
      totalPages: number;
    }
  | { kind: 'PURCHASES'; items: PurchaseView[]; page: number; total: number; totalPages: number };
