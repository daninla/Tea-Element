import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  PaymentProvider,
  PaymentProviderError,
  type CheckoutIntent,
  type PaymentIdentity,
  type PaymentObservation,
  type ProviderWebhook,
  type ProviderStatus,
  type HostedCheckout,
  type RefundResult,
} from '../domain/payment-provider';
import {
  validateCheckout,
  validateIdentity,
  kopecksToDecimal,
  decimalToKopecks,
  matchPayment,
} from '../domain/payment-validation';
import { decodePayload, encodePayload, equalSignature, validEnvelope } from './provider-codec';
export interface LiqPayOptions {
  publicKey: string;
  privateKey: string;
  callbackUrl: string;
  storefrontOrigin: string;
}
const identitySchema = z.object({
  public_key: z.string(),
  order_id: z.string(),
  amount: z.union([z.string(), z.number()]),
  currency: z.string(),
  status: z.string(),
  refund_amount: z.union([z.string(), z.number()]).optional(),
  wait_amount: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
  payment_id: z
    .union([z.string().min(1).max(100), z.number().int().nonnegative().safe()])
    .optional(),
  action: z.literal('pay').optional(),
});
const pending = new Set([
  'prepared',
  'processing',
  'wait_accept',
  '3ds_verify',
  'otp_verify',
  'cvv_verify',
  'phone_verify',
  'pin_verify',
  'senderapp_verify',
  'wait_qr',
  'p24_verify',
  'mp_verify',
  'cash_wait',
  'invoice_wait',
  'captcha_verify',
  'ivr_verify',
  'password_verify',
  'wait_sender',
  'wait_card',
  'wait_compensation',
  'wait_lc',
  'wait_secure',
]);
export class LiqPayProvider extends PaymentProvider {
  constructor(
    private readonly options: LiqPayOptions,
    private readonly transport: typeof fetch = fetch,
  ) {
    super();
    const { publicKey, privateKey, callbackUrl, storefrontOrigin } = options;
    if (
      !publicKey.startsWith('sandbox_') ||
      publicKey.length <= 8 ||
      !privateKey.startsWith('sandbox_') ||
      privateKey.length <= 8
    )
      throw new PaymentProviderError('INVALID_INPUT');
    if (callbackUrl.length > 510) throw new PaymentProviderError('INVALID_INPUT');
    this.validateUrl(callbackUrl);
    this.validateUrl(storefrontOrigin);
  }
  private validateUrl(value: string) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error();
      return url;
    } catch {
      throw new PaymentProviderError('INVALID_INPUT');
    }
  }
  private signature(data: string) {
    return createHash('sha3-256')
      .update(this.options.privateKey)
      .update(data)
      .update(this.options.privateKey)
      .digest('base64');
  }
  private fields(payload: Record<string, unknown>): ProviderWebhook {
    const data = encodePayload({ public_key: this.options.publicKey, version: 7, ...payload });
    return { data, signature: this.signature(data) };
  }
  async createCheckout(input: CheckoutIntent): Promise<HostedCheckout> {
    validateCheckout(input);
    const resultUrl = this.validateUrl(input.returnUrl);
    if (
      resultUrl.origin !== new URL(this.options.storefrontOrigin).origin ||
      input.returnUrl.length > 510
    )
      throw new PaymentProviderError('INVALID_INPUT');
    return {
      provider: 'LIQPAY',
      method: 'POST',
      actionUrl: 'https://www.liqpay.ua/api/3/checkout',
      fields: this.fields({
        action: 'pay',
        amount: kopecksToDecimal(input.amount),
        currency: input.currency,
        description: `Tea Element ${input.orderNumber}`,
        order_id: input.paymentId,
        language: 'uk',
        paytypes: 'card,apay,gpay,privat24',
        result_url: input.returnUrl,
        server_url: this.options.callbackUrl,
        expired_date: new Date(input.expiresAt).toISOString().slice(0, 19).replace('T', ' '),
      }),
    };
  }
  verifyWebhook(input: ProviderWebhook) {
    return validEnvelope(input) && equalSignature(input.signature, this.signature(input.data));
  }
  parseWebhook(input: ProviderWebhook, expected: PaymentIdentity): PaymentObservation {
    if (!this.verifyWebhook(input)) throw new PaymentProviderError('INVALID_SIGNATURE');
    return this.observation(decodePayload(input.data), expected);
  }
  private observation(raw: unknown, expected: PaymentIdentity): PaymentObservation {
    const parsed = identitySchema.safeParse(raw);
    if (!parsed.success) throw new PaymentProviderError('INVALID_RESPONSE');
    const body = parsed.data;
    if (body.public_key !== this.options.publicKey)
      throw new PaymentProviderError('PAYMENT_MISMATCH');
    const amount = decimalToKopecks(body.amount);
    if (body.currency !== expected.currency) throw new PaymentProviderError('PAYMENT_MISMATCH');
    const identity = { paymentId: body.order_id, amount, currency: expected.currency };
    matchPayment(identity, expected);
    let status: ProviderStatus;
    if (body.status === 'success') status = 'SUCCEEDED';
    else if (body.status === 'wait_reserve') status = 'REFUND_PENDING';
    else if (body.status === 'failure' || body.status === 'error') status = 'FAILED';
    else if (body.status === 'reversed')
      status =
        body.wait_amount === true || body.wait_amount === 'true' ? 'REFUND_PENDING' : 'REFUNDED';
    else if (pending.has(body.status)) status = 'PENDING';
    else throw new PaymentProviderError('INVALID_RESPONSE');
    const refundedAmount =
      body.refund_amount === undefined ? undefined : decimalToKopecks(body.refund_amount, 0);
    if (refundedAmount !== undefined && refundedAmount > amount)
      throw new PaymentProviderError('INVALID_RESPONSE');
    if (status === 'REFUNDED' && refundedAmount === 0)
      throw new PaymentProviderError('INVALID_RESPONSE');
    if (refundedAmount && status !== 'REFUND_PENDING') {
      if (status !== 'SUCCEEDED' && status !== 'REFUNDED')
        throw new PaymentProviderError('INVALID_RESPONSE');
      status = refundedAmount === amount ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    }
    if (status !== 'PENDING' && body.payment_id === undefined)
      throw new PaymentProviderError('INVALID_RESPONSE');
    return {
      ...identity,
      status,
      ...(refundedAmount === undefined ? {} : { refundedAmount }),
      ...(body.payment_id === undefined ? {} : { providerPaymentId: String(body.payment_id) }),
    };
  }
  private async request(payload: Record<string, unknown>): Promise<unknown> {
    const fields = this.fields(payload);
    try {
      const response = await this.transport('https://www.liqpay.ua/api/request', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...fields }),
        signal: AbortSignal.timeout(5000),
        redirect: 'error',
      });
      if (!response.ok) throw new Error();
      if (!response.body) throw new Error();
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 65_536) {
            await reader.cancel();
            throw new Error();
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      throw new PaymentProviderError('PROVIDER_UNAVAILABLE');
    }
  }
  async getStatus(expected: PaymentIdentity) {
    validateIdentity(expected);
    const body = await this.request({ action: 'status', order_id: expected.paymentId });
    return this.observation(body, expected);
  }
  async refund(expected: PaymentIdentity): Promise<RefundResult> {
    validateIdentity(expected);
    // Status is checked before every full refund; an unknown transport result is never blindly retried.
    const current = await this.getStatus(expected);
    if (current.status === 'REFUNDED')
      return { status: 'REFUNDED', providerPaymentId: current.providerPaymentId };
    if (current.status === 'REFUND_PENDING')
      return { status: 'PENDING', providerPaymentId: current.providerPaymentId };
    if (current.status !== 'SUCCEEDED') throw new PaymentProviderError('INVALID_TRANSITION');
    const raw = await this.request({
      action: 'refund',
      order_id: expected.paymentId,
      amount: kopecksToDecimal(expected.amount),
    });
    const parsed = z
      .object({
        result: z.literal('ok'),
        status: z.string(),
        payment_id: z.union([z.string().min(1).max(100), z.number().int().nonnegative().safe()]),
        wait_amount: z.union([z.boolean(), z.enum(['true', 'false'])]).optional(),
      })
      .safeParse(raw);
    if (!parsed.success) throw new PaymentProviderError('INVALID_RESPONSE');
    if (String(parsed.data.payment_id) !== current.providerPaymentId)
      throw new PaymentProviderError('PAYMENT_MISMATCH');
    if (!['reversed', 'success', 'processing'].includes(parsed.data.status))
      throw new PaymentProviderError('INVALID_RESPONSE');
    return {
      status:
        parsed.data.status === 'reversed' &&
        parsed.data.wait_amount !== true &&
        parsed.data.wait_amount !== 'true'
          ? 'REFUNDED'
          : 'PENDING',
      providerPaymentId: String(parsed.data.payment_id),
    };
  }
}
