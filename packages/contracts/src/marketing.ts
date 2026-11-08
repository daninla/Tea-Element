import type { OrderCompleted } from './orders';
import type { UserRegistered } from './auth';
export type MarketingEvent = UserRegistered | OrderCompleted;
export const MARKETING_PATTERNS = { unsubscribe: 'marketing.unsubscribe' } as const;
export const MARKETING_SUBSCRIPTIONS = [
  ['marketing.user_registered', 'auth.user_registered'],
  ['marketing.order_completed', 'orders.order_completed'],
] as const;
