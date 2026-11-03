import type { ProductView } from '@tea/contracts';
export function productImage(product: Pick<ProductView, 'images' | 'category'>) {
  const localImage = product.images.find((path) => path.startsWith('/') && !path.startsWith('//'));
  if (localImage) return localImage;
  if (['oolong', 'gaba', 'green'].includes(product.category.slug)) return '/images/green-tea.png';
  if (['white', 'herbal'].includes(product.category.slug)) return '/images/tea-ritual.png';
  return '/images/dark-tea.png';
}
