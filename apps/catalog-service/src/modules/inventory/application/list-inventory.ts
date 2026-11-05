import { Inject, Injectable } from '@nestjs/common';
import type { InventoryFilters } from '@tea/contracts';
import { InventoryStore } from '../domain/inventory-store';
@Injectable()
export class ListInventory {
  constructor(@Inject(InventoryStore) private readonly store: InventoryStore) {}
  execute(input: InventoryFilters) {
    return this.store.list(input);
  }
}
