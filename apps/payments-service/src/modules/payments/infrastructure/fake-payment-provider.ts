import { createHmac } from 'node:crypto';
import { z } from 'zod';
import {
  PaymentProvider,
  PaymentProviderError,
  type CheckoutIntent,
  type PaymentIdentity,
  type ProviderWebhook,
  type PaymentObservation,
  type HostedCheckout,
} from '../domain/payment-provider';
import { validateCheckout, matchPayment, validateIdentity } from '../domain/payment-validation';
import { decodePayload, encodePayload, equalSignature, validEnvelope } from './provider-codec';
const schema = z
  .object({
    paymentId: z.string(),
    amount: z.number().int(),
    currency: z.literal('UAH'),
    status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']),
    providerPaymentId: z.string(),
  })
  .strict();
/** In-memory provider simulator, not the application payment ledger. No public simulation endpoint. */
export class FakePaymentProvider extends PaymentProvider {
  private readonly payments = new Map<string, PaymentObservation>();
  constructor(private readonly secret: string) {
    super();
    if (secret.length < 32) throw new PaymentProviderError('INVALID_INPUT');
  }
  private signature(data: string) {
    return createHmac('sha256', this.secret).update(data).digest('base64');
  }
  async createCheckout(input: CheckoutIntent): Promise<HostedCheckout> {
    validateCheckout(input);
    const existing = this.payments.get(input.paymentId);
    if (existing) matchPayment(existing, input);
    else
      this.payments.set(input.paymentId, {
        paymentId: input.paymentId,
        amount: input.amount,
        currency: input.currency,
        status: 'PENDING',
        providerPaymentId: `fake_${input.paymentId}`,
      });
    return { provider: 'FAKE', paymentId: input.paymentId };
  }
  verifyWebhook(input: ProviderWebhook) {
    return validEnvelope(input) && equalSignature(input.signature, this.signature(input.data));
  }
  parseWebhook(input: ProviderWebhook, expected: PaymentIdentity) {
    if (!this.verifyWebhook(input)) throw new PaymentProviderError('INVALID_SIGNATURE');
    const parsed = schema.safeParse(decodePayload(input.data));
    if (!parsed.success) throw new PaymentProviderError('INVALID_RESPONSE');
    matchPayment(parsed.data, expected);
    if (parsed.data.providerPaymentId !== `fake_${expected.paymentId}`)
      throw new PaymentProviderError('PAYMENT_MISMATCH');
    return parsed.data;
  }
  async getStatus(expected: PaymentIdentity) {
    validateIdentity(expected);
    const current = this.payments.get(expected.paymentId);
    if (!current) throw new PaymentProviderError('PAYMENT_NOT_FOUND');
    matchPayment(current, expected);
    return { ...current };
  }
  /** Test harness hook: change provider state, optionally omit delivery to exercise reconciliation. */
  settle(paymentId: string, status: 'SUCCEEDED' | 'FAILED'): ProviderWebhook {
    const current = this.payments.get(paymentId);
    if (!current) throw new PaymentProviderError('PAYMENT_NOT_FOUND');
    if (current.status !== 'PENDING' && current.status !== status)
      throw new PaymentProviderError('INVALID_TRANSITION');
    current.status = status;
    const data = encodePayload(current);
    return { data, signature: this.signature(data) };
  }
  async refund(expected: PaymentIdentity) {
    const current = await this.getStatus(expected);
    if (!['SUCCEEDED', 'REFUNDED'].includes(current.status))
      throw new PaymentProviderError('INVALID_TRANSITION');
    this.payments.set(expected.paymentId, { ...current, status: 'REFUNDED' });
    return { status: 'REFUNDED' as const, providerPaymentId: current.providerPaymentId };
  }
}
