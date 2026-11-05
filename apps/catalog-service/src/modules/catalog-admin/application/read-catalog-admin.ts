import { Inject, Injectable } from '@nestjs/common';
import type { CatalogAdminRead } from '@tea/contracts';
import { CatalogAdminStore } from '../domain/catalog-admin-store';
@Injectable()
export class ReadCatalogAdmin {
  constructor(@Inject(CatalogAdminStore) private readonly store: CatalogAdminStore) {}
  execute(input: CatalogAdminRead) {
    return this.store.read(input);
  }
}
