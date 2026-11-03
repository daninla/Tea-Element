import type { CatalogRequest, CatalogResult } from '@tea/contracts';
export abstract class CatalogClient {
  abstract request<T>(pattern: string, request: CatalogRequest<unknown>): Promise<CatalogResult<T>>;
}
