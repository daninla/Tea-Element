import type { CategoryView } from '@tea/contracts';
export function productHref(slug: string, weightGrams: number | null) {
  return `/product/${encodeURIComponent(slug)}${weightGrams === null ? '' : `?weight=${weightGrams}`}`;
}
export function categoryHref(category: Pick<CategoryView, 'slug' | 'section'>) {
  return category.section === 'EQUIPMENT'
    ? `/teaware?category=${encodeURIComponent(category.slug)}`
    : `/catalog/${encodeURIComponent(category.slug)}`;
}
