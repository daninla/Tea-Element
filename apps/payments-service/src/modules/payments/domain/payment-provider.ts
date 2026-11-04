export interface PaymentIdentity {
  /** Unique merchant payment attempt ID, not a reusable order number. */
  paymentId: string;
  amount: number;
  currency: 'UAH';
}
export interface CheckoutIntent extends PaymentIdentity {
  orderNumber: string;
  expiresAt: string;
  returnUrl: string;
}
export type HostedCheckout =
  | { provider: 'FAKE'; paymentId: string }
  | { provider: 'LIQPAY'; method: 'POST'; actionUrl: string; fields: ProviderWebhook };
export interface ProviderWebhook {
  data: string;
  signature: string;
}
export type ProviderStatus =
  'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED';
export interface PaymentObservation extends PaymentIdentity {
  status: ProviderStatus;
  providerPaymentId?: string;
  refundedAmount?: number;
}
export interface RefundResult {
  status: 'PENDING' | 'REFUNDED';
  providerPaymentId?: string;
}
export abstract class PaymentProvider {
  abstract createCheckout(input: CheckoutIntent): Promise<HostedCheckout>;
  abstract verifyWebhook(input: ProviderWebhook): boolean;
  /** Verification and identity/amount validation are mandatory even if called directly. */
  abstract parseWebhook(input: ProviderWebhook, expected: PaymentIdentity): PaymentObservation;
  abstract getStatus(expected: PaymentIdentity): Promise<PaymentObservation>;
  /** Full refund only. The durable workflow must reconcile ambiguous results before retrying. */
  abstract refund(expected: PaymentIdentity): Promise<RefundResult>;
}
export class PaymentProviderError extends Error {
  constructor(
    readonly code:
      | 'INVALID_INPUT'
      | 'INVALID_SIGNATURE'
      | 'PAYMENT_MISMATCH'
      | 'INVALID_RESPONSE'
      | 'PROVIDER_UNAVAILABLE'
      | 'PAYMENT_NOT_FOUND'
      | 'INVALID_TRANSITION',
  ) {
    // Never include raw provider errors, payloads, URLs or keys in the error message.
    super(code);
    this.name = 'PaymentProviderError';
  }
}
