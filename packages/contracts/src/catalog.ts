export const CATALOG_PATTERNS = {
  categories: 'catalog.categories',
  products: 'catalog.products',
  product: 'catalog.product',
} as const;
export const CATALOG_SORTS = ['popular', 'price_asc', 'price_desc', 'newest'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];
export interface CatalogQuery {
  category?: string;
  q?: string;
  origin?: string;
  minPrice?: number;
  maxPrice?: number;
  onSale?: boolean;
  inStock?: boolean;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
}
export interface CategoryView {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  productsCount: number;
}
export interface VariantView {
  id: string;
  sku: string;
  weightGrams: number;
  originalPrice: number;
  price: number;
  onSale: boolean;
  inStock: boolean;
}
export interface BrewingGuide {
  temperatureCelsius: number;
  seconds: number;
  infusions: number;
}
export interface ProductView {
  id: string;
  slug: string;
  name: string;
  nameOriginal: string;
  description: string;
  origin: string;
  year: number | null;
  brewingGuide: BrewingGuide;
  images: string[];
  tags: string[];
  category: Omit<CategoryView, 'productsCount'>;
  variants: VariantView[];
  minPrice: number;
  onSale: boolean;
  inStock: boolean;
  createdAt: string;
}
export interface ProductPage {
  items: ProductView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface CatalogRequest<T> {
  input: T;
  context: { correlationId: string };
}
export type CatalogResult<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      error: {
        code: 'INVALID_INPUT' | 'PRODUCT_NOT_FOUND' | 'CATALOG_UNAVAILABLE';
        message: string;
        statusCode: number;
      };
    };
