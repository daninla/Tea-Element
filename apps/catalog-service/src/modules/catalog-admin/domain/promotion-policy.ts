import type { PromotionInput } from '@tea/contracts';
import { CatalogAdminError } from './catalog-admin-store';
export function validatePromotion(input: PromotionInput) {
  const start = new Date(input.startsAt).getTime(),
    end = new Date(input.endsAt).getTime();
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start >= end ||
    !Number.isInteger(input.value) ||
    input.value < 1 ||
    input.value > 2147483647 ||
    (input.type === 'PERCENT' && input.value > 100) ||
    input.targets.length < 1 ||
    input.targets.length > 50 ||
    new Set(input.targets.map((x) => x.kind + ':' + x.id)).size !== input.targets.length
  )
    throw new CatalogAdminError('INVALID_INPUT', 'Invalid promotion period, value or targets', 400);
}
