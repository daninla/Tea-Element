import { Inject, Injectable } from '@nestjs/common';

import { CatalogMediaStore } from '../domain/catalog-admin-store';
@Injectable()
export class ReadCatalogImage {
  constructor(@Inject(CatalogMediaStore) private readonly store: CatalogMediaStore) {}
  execute(id: string) {
    return this.store.get(id);
  }
}
