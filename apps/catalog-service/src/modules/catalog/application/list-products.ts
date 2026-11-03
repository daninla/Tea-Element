import { Inject, Injectable } from '@nestjs/common';
import type { CatalogQuery, ProductPage } from '@tea/contracts';
import { CatalogRepository, CatalogError } from '../domain/catalog-repository';
import { productView } from '../domain/pricing';
@Injectable()
export class ListProducts {
  constructor(@Inject(CatalogRepository) private readonly repository: CatalogRepository) {}
  async execute(input: CatalogQuery): Promise<ProductPage> {
    if (
      input.minPrice !== undefined &&
      input.maxPrice !== undefined &&
      input.minPrice > input.maxPrice
    )
      throw new CatalogError('INVALID_INPUT', 'minPrice must not exceed maxPrice', 400);
    const query = {
      ...input,
      page: input.page ?? 1,
      pageSize: input.pageSize ?? 12,
      sort: input.sort ?? ('newest' as const),
    };
    const now = new Date();
    const result = await this.repository.list(query, now);
    return {
      items: result.products.map((p) => productView(p, now)),
      total: result.total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(result.total / query.pageSize),
    };
  }
}
