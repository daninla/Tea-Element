import { Inject, Injectable } from '@nestjs/common';

import { CatalogMediaStore } from '../domain/catalog-admin-store';
@Injectable()
export class UploadCatalogImage {
  constructor(@Inject(CatalogMediaStore) private readonly store: CatalogMediaStore) {}
  execute(base64: string, actorId: string) {
    return this.store.upload(base64, actorId);
  }
}
