import type { DomainEvent } from './auth';
export const PAYMENTS_PATTERNS = {
  checkout: 'payments.checkout',
  status: 'payments.status',
  webhook: 'payments.webhook',
  simulate: 'payments.simulate',
} as const;
export interface PaymentAccess {
  number: string;
  token?: string;
}
export interface PaymentView {
  id: string;
  orderId: string;
  status: string;
  amount: number;
  currency: 'UAH';
  expiresAt: string;
}
export type PaymentCheckoutView = {
  payment: PaymentView;
  checkout:
    | { provider: 'FAKE'; paymentId: string }
    | {
        provider: 'LIQPAY';
        method: 'POST';
        actionUrl: string;
        fields: { data: string; signature: string };
      };
};
export type PaymentRequested = DomainEvent<
  'PaymentRequested',
  {
    paymentId: string;
    orderId: string;
    orderNumber: string;
    amount: number;
    currency: 'UAH';
    expiresAt: string;
  }
>;
export type PaymentOutcome = DomainEvent<
  'PaymentSucceeded' | 'PaymentFailed' | 'PaymentExpired' | 'PaymentRefunded',
  { paymentId: string; orderId: string; amount: number; currency: 'UAH' }
>;

export type PaymentAttemptAbandoned = DomainEvent<
  'PaymentAttemptAbandoned',
  { orderId: string; paymentId: string }
>;
