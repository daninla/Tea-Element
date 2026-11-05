import { Inject, Injectable } from '@nestjs/common';

import { InventoryStore } from '../domain/inventory-store';
@Injectable()
export class ReadInventoryHistory {
  constructor(@Inject(InventoryStore) private readonly store: InventoryStore) {}
  execute(productId: string | undefined, kind: 'MOVEMENTS' | 'PURCHASES', page: number) {
    return this.store.history(productId, kind, page);
  }
}
