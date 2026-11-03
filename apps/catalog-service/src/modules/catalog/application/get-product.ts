import { Inject, Injectable } from '@nestjs/common';
import { CatalogRepository, CatalogError } from '../domain/catalog-repository';
import { productView } from '../domain/pricing';
@Injectable()
export class GetProduct {
  constructor(@Inject(CatalogRepository) private readonly repository: CatalogRepository) {}
  async execute(slug: string) {
    const now = new Date();
    const product = await this.repository.bySlug(slug, now);
    if (!product) throw new CatalogError('PRODUCT_NOT_FOUND', 'Product not found', 404);
    return productView(product, now);
  }
}
