import { Inject, Injectable } from '@nestjs/common';
import type { CatalogAdminWrite } from '@tea/contracts';
import { CatalogAdminStore } from '../domain/catalog-admin-store';
@Injectable()
export class WriteCatalogAdmin {
  constructor(@Inject(CatalogAdminStore) private readonly store: CatalogAdminStore) {}
  execute(input: CatalogAdminWrite, actorId: string) {
    return this.store.write(input, actorId);
  }
}
