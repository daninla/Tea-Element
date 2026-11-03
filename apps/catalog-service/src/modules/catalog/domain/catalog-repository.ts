import type {
  BrewingGuide,
  CatalogQuery,
  CategoryView,
  ProductPage,
  ProductView,
} from '@tea/contracts';
export interface Promotion {
  id: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  startsAt: Date;
  endsAt: Date;
  isActive: boolean;
}
export interface CatalogProduct {
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
  createdAt: Date;
  category: Omit<CategoryView, 'productsCount'>;
  variants: { id: string; sku: string; weightGrams: number; price: number }[];
  inventory: { stockGrams: number; reservedGrams: number } | null;
  promotions: Promotion[];
}
export abstract class CatalogRepository {
  abstract categories(): Promise<CategoryView[]>;
  abstract list(
    query: Required<Pick<CatalogQuery, 'sort' | 'page' | 'pageSize'>> & CatalogQuery,
    now: Date,
  ): Promise<{ products: CatalogProduct[]; total: number }>;
  abstract bySlug(slug: string, now: Date): Promise<CatalogProduct | null>;
}
export class CatalogError extends Error {
  constructor(
    public readonly code: 'INVALID_INPUT' | 'PRODUCT_NOT_FOUND',
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}
export type CatalogPage = ProductPage;
export type CatalogView = ProductView;
