import type { VariantView } from '@tea/contracts';
export function selectedVariant(variants: VariantView[], weight: string | null | undefined) {
  const grams = weight && /^\d+$/.test(weight) ? Number(weight) : undefined;
  return variants.find((variant) => variant.weightGrams === grams) ?? variants[0];
}
export function serializeJsonLd(data: unknown) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
