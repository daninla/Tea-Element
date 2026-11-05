import { Inject, Injectable } from '@nestjs/common';
import type { AdjustmentInput } from '@tea/contracts';
import { InventoryStore } from '../domain/inventory-store';
@Injectable()
export class AdjustInventory {
  constructor(@Inject(InventoryStore) private readonly store: InventoryStore) {}
  execute(input: AdjustmentInput, actorId: string) {
    return this.store.adjust(input, actorId);
  }
}
