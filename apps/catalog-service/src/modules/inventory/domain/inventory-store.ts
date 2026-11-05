import type {
  InventoryFilters,
  InventoryPage,
  InventoryItem,
  InventoryHistory,
  PurchaseInput,
  AdjustmentInput,
  InventoryCommandResult,
} from '@tea/contracts';
export abstract class InventoryStore {
  abstract list(input: InventoryFilters): Promise<InventoryPage>;
  abstract get(productId: string): Promise<InventoryItem>;
  abstract history(
    productId: string | undefined,
    kind: 'MOVEMENTS' | 'PURCHASES',
    page: number,
  ): Promise<InventoryHistory>;
  abstract purchase(input: PurchaseInput, actorId: string): Promise<InventoryCommandResult>;
  abstract adjust(input: AdjustmentInput, actorId: string): Promise<InventoryCommandResult>;
}
