import type {
  CatalogAdminRead,
  CatalogAdminWrite,
  CatalogReadResult,
  AdminProduct,
  AdminCategory,
  MediaAssetView,
} from '@tea/contracts';
export class CatalogAdminError extends Error {
  constructor(
    public readonly code:
      | 'INVALID_INPUT'
      | 'PRODUCT_NOT_FOUND'
      | 'CATALOG_CONFLICT'
      | 'STALE_CATALOG'
      | 'IMMUTABLE_FIELD'
      | 'IDEMPOTENCY_CONFLICT'
      | 'MEDIA_NOT_FOUND',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
export abstract class CatalogAdminStore {
  abstract read(input: CatalogAdminRead): Promise<CatalogReadResult>;
  abstract write(input: CatalogAdminWrite, actorId: string): Promise<AdminProduct | AdminCategory>;
}
export abstract class CatalogMediaStore {
  abstract upload(base64: string, actorId: string): Promise<MediaAssetView>;
  abstract get(id: string): Promise<{ base64: string; etag: string }>;
}
