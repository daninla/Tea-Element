import { Inject, Injectable } from '@nestjs/common';
import { CatalogAdminStore } from '../domain/catalog-admin-store';
@Injectable()
export class ReadMarketingPromotions {
  constructor(@Inject(CatalogAdminStore) private readonly store: CatalogAdminStore) {}
  execute(after?: string) {
    return this.store.marketingPromotions(after);
  }
}
