import type { AdminProductInput, AdminVariantInput } from '@tea/contracts';
import { BUNDLED_CATALOG_IMAGES } from '@tea/contracts';
import { CatalogAdminError } from './catalog-admin-store';
export const uploadedImageId = (path: string) =>
  /^\/media\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.webp$/.exec(path)?.[1];
export function validImagePath(path: string) {
  return (BUNDLED_CATALOG_IMAGES as readonly string[]).includes(path) || !!uploadedImageId(path);
}
export function validateProductUnit(
  input: AdminProductInput,
  section: 'TEA' | 'EQUIPMENT',
  previous?: AdminVariantInput[],
) {
  if (
    input.variants.length < 1 ||
    input.variants.length > 20 ||
    new Set(input.variants.map((x) => x.sku)).size !== input.variants.length ||
    new Set(input.variants.flatMap((x) => (x.id ? [x.id] : []))).size !==
      input.variants.filter((x) => x.id).length
  )
    throw new CatalogAdminError('INVALID_INPUT', 'Invalid variants', 400);
  if (
    section === 'EQUIPMENT' &&
    (input.variants.length !== 1 ||
      input.variants[0]!.weightGrams !== null ||
      input.brewingGuide !== null)
  )
    throw new CatalogAdminError(
      'INVALID_INPUT',
      'Piece goods have one unit variant and no brewing guide',
      400,
    );
  if (
    section === 'TEA' &&
    (input.variants.some(
      (x) => x.weightGrams === null || !Number.isInteger(x.weightGrams) || x.weightGrams <= 0,
    ) ||
      new Set(input.variants.map((x) => x.weightGrams)).size !== input.variants.length)
  )
    throw new CatalogAdminError(
      'INVALID_INPUT',
      'Tea requires distinct positive gram portions',
      400,
    );
  if (input.isActive && !input.variants.some((x) => x.isActive))
    throw new CatalogAdminError('INVALID_INPUT', 'Active product requires an active variant', 400);
  if (input.images.some((x) => !validImagePath(x)))
    throw new CatalogAdminError('INVALID_INPUT', 'Use registered or bundled images', 400);
  if (previous)
    for (const old of previous) {
      const next = input.variants.find((x) => x.id === old.id);
      if (!next || next.weightGrams !== old.weightGrams || next.sku !== old.sku)
        throw new CatalogAdminError(
          'IMMUTABLE_FIELD',
          'Existing variants keep their ID, SKU and weight; deactivate instead',
          409,
        );
    }
}
