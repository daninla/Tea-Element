import type {
  PaymentRequested,
  PaymentAttemptAbandoned,
  OrderCancelled,
  PaymentView,
} from '@tea/contracts';
import type { PaymentObservation, ProviderWebhook, PaymentIdentity } from './payment-provider';
export interface StoredPayment extends PaymentView {
  reconcileCommandIds?: string[];
  provider: string;
  cancelRequested: boolean;
}
export abstract class PaymentStore {
  abstract register(event: PaymentRequested): Promise<void>;
  abstract cancel(event: OrderCancelled | PaymentAttemptAbandoned): Promise<void>;
  abstract find(id: string): Promise<StoredPayment | null>;
  abstract forOrder(orderId: string): Promise<StoredPayment | null>;
  abstract audit(raw: ProviderWebhook, valid: boolean): Promise<string>;
  abstract auditOutcome(id: string, outcome: string, paymentId?: string): Promise<void>;
  abstract observe(observation: PaymentObservation, correlationId: string): Promise<void>;
  abstract due(): Promise<StoredPayment[]>;
  abstract defer(id: string, commandIds?: string[]): Promise<void>;
  abstract expire(): Promise<void>;
  abstract claimRefund(): Promise<StoredPayment | null>;
  abstract refundResult(
    id: string,
    status: 'PENDING' | 'REFUNDED' | 'REVIEW_REQUIRED',
    correlationId: string,
  ): Promise<void>;
}
export abstract class PaymentOrderAccess {
  abstract get(
    input: { number: string; token?: string },
    context: { correlationId: string; userId?: string },
  ): Promise<import('@tea/contracts').OrderView>;
}
export function identity(payment: StoredPayment): PaymentIdentity {
  return { paymentId: payment.id, amount: payment.amount, currency: payment.currency };
}
export class PaymentError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}
