import { Inject, Injectable } from '@nestjs/common';

import { InventoryStore } from '../domain/inventory-store';
@Injectable()
export class GetInventory {
  constructor(@Inject(InventoryStore) private readonly store: InventoryStore) {}
  execute(productId: string) {
    return this.store.get(productId);
  }
}
