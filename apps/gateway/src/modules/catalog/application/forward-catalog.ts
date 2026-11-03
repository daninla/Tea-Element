import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { CatalogRequest } from '@tea/contracts';
import { CatalogClient } from '../domain/catalog-client';
@Injectable()
export class ForwardCatalog {
  constructor(@Inject(CatalogClient) private readonly client: CatalogClient) {}
  async execute<T>(pattern: string, request: CatalogRequest<unknown>): Promise<T> {
    const result = await this.client.request<T>(pattern, request);
    if (!result.ok) throw new HttpException(result.error, result.error.statusCode);
    return result.value;
  }
}
