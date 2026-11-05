import { Inject, Injectable } from '@nestjs/common';
import type { PurchaseInput } from '@tea/contracts';
import { InventoryStore } from '../domain/inventory-store';
@Injectable()
export class RecordPurchase {
  constructor(@Inject(InventoryStore) private readonly store: InventoryStore) {}
  execute(input: PurchaseInput, actorId: string) {
    return this.store.purchase(input, actorId);
  }
}
