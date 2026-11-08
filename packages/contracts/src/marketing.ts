import type { OrderCompleted } from './orders';
import type { UserRegistered } from './auth';
export type MarketingEvent = UserRegistered | OrderCompleted;
export const MARKETING_PATTERNS = {
  unsubscribe: 'marketing.unsubscribe',
  adminRead: 'marketing.admin.read',
  configure: 'marketing.admin.configure',
} as const;
export const MARKETING_CAMPAIGNS = ['WIN_BACK', 'DISCOUNT'] as const;
export type MarketingCampaign = (typeof MARKETING_CAMPAIGNS)[number];
export const EMAIL_STATUSES = ['PENDING', 'SENT', 'FAILED', 'CANCELLED'] as const;
export interface CampaignSetting {
  campaign: MarketingCampaign;
  enabled: boolean;
  revision: number;
}
export interface CampaignConfiguration {
  campaign: MarketingCampaign;
  enabled: boolean;
  expectedRevision: number;
  key: string;
}
export interface MarketingLogPage {
  items: {
    id: string;
    email: string;
    campaign: string;
    status: string;
    attempts: number;
    createdAt: string;
    sentAt: string | null;
    promotionTitle: string | null;
  }[];
  page: number;
  total: number;
  totalPages: number;
}
export type MarketingAdminRead =
  | { kind: 'SETTINGS' }
  | {
      kind: 'LOGS';
      page: number;
      campaign?: MarketingCampaign;
      status?: (typeof EMAIL_STATUSES)[number];
      q?: string;
    };
export const CATALOG_MARKETING_PROMOTIONS_PATTERN = 'catalog.marketing.promotions';
export interface MarketingPromotion {
  id: string;
  title: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
  revision: number;
}
export interface MarketingPromotionPage {
  items: MarketingPromotion[];
  nextCursor: string | null;
}
export const MARKETING_SUBSCRIPTIONS = [
  ['marketing.user_registered', 'auth.user_registered'],
  ['marketing.order_completed', 'orders.order_completed'],
] as const;
