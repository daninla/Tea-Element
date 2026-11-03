import { Inject, Injectable } from '@nestjs/common';
import { CatalogRepository } from '../domain/catalog-repository';
@Injectable()
export class ListCategories {
  constructor(@Inject(CatalogRepository) private readonly repository: CatalogRepository) {}
  execute() {
    return this.repository.categories();
  }
}
