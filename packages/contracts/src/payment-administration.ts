export const ADMIN_PAYMENTS_PATTERNS = {
  read: 'admin.payments.read',
  reconcile: 'admin.payments.reconcile',
} as const;
export const PAYMENT_STATUSES = [
  'CREATED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'EXPIRED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
] as const;
export type AdminPaymentStatus = (typeof PAYMENT_STATUSES)[number];
export interface AdminPayment {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  currency: string;
  provider: string;
  status: AdminPaymentStatus;
  providerPaymentId: string | null;
  cancelRequested: boolean;
  expiresAt: string;
  paidAt: string | null;
  nextReconcileAt: string;
  createdAt: string;
  updatedAt: string;
  refundStatus: string | null;
}
export interface AdminPaymentPage {
  items: AdminPayment[];
  page: number;
  total: number;
  totalPages: number;
}
export interface AdminPaymentDetail {
  payment: AdminPayment;
  refund: {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  } | null;
}
export interface AdminPaymentEvent {
  id: string;
  paymentId: string | null;
  signatureValid: boolean;
  outcome: string;
  createdAt: string;
}
export interface AdminPaymentEvents {
  items: AdminPaymentEvent[];
  page: number;
  total: number;
  totalPages: number;
}
export interface ReconciliationReceipt {
  id: string;
  paymentId: string;
  requestedAt: string;
  status: 'QUEUED';
}
export interface AdminPaymentCommands {
  items: {
    id: string;
    actorId: string;
    reason: string;
    attemptedAt: string | null;
    createdAt: string;
  }[];
  page: number;
  total: number;
  totalPages: number;
}
export type AdminPaymentsRead =
  | {
      kind: 'LIST';
      page: number;
      q?: string;
      status?: AdminPaymentStatus;
      provider?: 'FAKE' | 'LIQPAY';
      refundOnly?: boolean;
      from?: string;
      to?: string;
    }
  | { kind: 'DETAIL'; id: string }
  | { kind: 'EVENTS'; page: number; paymentId?: string; signatureValid?: boolean }
  | { kind: 'COMMANDS'; id: string; page: number };
export interface AdminReconciliation {
  paymentId: string;
  expectedStatus: AdminPaymentStatus;
  reason: string;
  key: string;
}
