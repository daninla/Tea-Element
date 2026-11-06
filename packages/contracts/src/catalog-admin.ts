import type { BrewingGuide } from './catalog';
export const CATALOG_ADMIN_PATTERNS = {
  read: 'admin.catalog.read',
  write: 'admin.catalog.write',
  upload: 'admin.catalog.upload',
  media: 'catalog.media',
} as const;
export const BUNDLED_CATALOG_IMAGES = [
  '/images/dark-tea.png',
  '/images/green-tea.png',
  '/images/tea-ritual.png',
  '/images/tea-cup.png',
  '/images/gaiwan.png',
  '/images/tea-strainer.png',
  '/images/tea-tongs.png',
] as const;
export interface AdminCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  section: 'TEA' | 'EQUIPMENT';
  sortOrder: number;
  isActive: boolean;
  revision: number;
}
export interface AdminVariantInput {
  id?: string;
  sku: string;
  weightGrams: number | null;
  price: number;
  isActive: boolean;
}
export interface AdminProductInput {
  slug: string;
  name: string;
  nameOriginal: string;
  description: string;
  origin: string;
  year: number | null;
  brewingGuide: BrewingGuide | null;
  categoryId: string;
  images: string[];
  tags: string[];
  isActive: boolean;
  variants: AdminVariantInput[];
}
export interface AdminProduct extends Omit<AdminProductInput, 'variants'> {
  id: string;
  revision: number;
  category: AdminCategory;
  variants: (AdminVariantInput & { id: string })[];
}
export type CategoryInput = Omit<AdminCategory, 'id' | 'revision'>;
export type CatalogAdminRead =
  | { kind: 'PRODUCTS'; page: number; q?: string; section?: 'TEA' | 'EQUIPMENT'; active?: boolean }
  | { kind: 'PRODUCT'; id: string }
  | {
      kind: 'CATEGORIES';
      page: number;
      pageSize?: number;
      q?: string;
      section?: 'TEA' | 'EQUIPMENT';
    }
  | { kind: 'PROMOTIONS'; page: number; q?: string; active?: boolean }
  | { kind: 'PROMOTION'; id: string }
  | { kind: 'AUDIT'; id: string; page: number };
export type CatalogAdminWrite =
  | { kind: 'CREATE_PROMOTION'; input: PromotionInput; key: string }
  | {
      kind: 'UPDATE_PROMOTION';
      id: string;
      expectedRevision: number;
      input: PromotionInput;
      key: string;
    }
  | { kind: 'CREATE_PRODUCT'; input: AdminProductInput; key: string }
  | {
      kind: 'UPDATE_PRODUCT';
      id: string;
      expectedRevision: number;
      input: AdminProductInput;
      key: string;
    }
  | { kind: 'CREATE_CATEGORY'; input: CategoryInput; key: string }
  | {
      kind: 'UPDATE_CATEGORY';
      id: string;
      expectedRevision: number;
      input: CategoryInput;
      key: string;
    };
export interface AdminProductPage {
  items: AdminProduct[];
  page: number;
  total: number;
  totalPages: number;
}
export interface AdminCategoryPage {
  items: AdminCategory[];
  page: number;
  total: number;
  totalPages: number;
}
export interface CatalogAuditPage {
  items: { id: string; actorId: string; kind: string; createdAt: string }[];
  page: number;
  total: number;
  totalPages: number;
}
export type CatalogReadResult =
  | AdminProduct
  | AdminProductPage
  | AdminCategoryPage
  | CatalogAuditPage
  | AdminPromotion
  | AdminPromotionPage;
export interface MediaAssetView {
  id: string;
  path: string;
  width: number;
  height: number;
}

export interface PromotionTargetInput {
  kind: 'PRODUCT' | 'CATEGORY';
  id: string;
}
export interface PromotionInput {
  name: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  targets: PromotionTargetInput[];
}
export interface AdminPromotion extends Omit<PromotionInput, 'targets'> {
  id: string;
  revision: number;
  targets: (PromotionTargetInput & { name: string })[];
}
export interface AdminPromotionPage {
  items: AdminPromotion[];
  page: number;
  total: number;
  totalPages: number;
}
export type CatalogWriteResult = AdminProduct | AdminCategory | AdminPromotion;
