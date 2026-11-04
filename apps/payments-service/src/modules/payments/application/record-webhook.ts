import { Inject, Injectable } from '@nestjs/common';
import { readEnvironment } from '../../../config/environment';
import { z } from 'zod';
import {
  PaymentProvider,
  PaymentProviderError,
  type ProviderWebhook,
} from '../domain/payment-provider';
import { PaymentStore, PaymentError, identity } from '../domain/payment-store';
@Injectable()
export class RecordWebhook {
  constructor(
    @Inject(PaymentStore) private readonly store: PaymentStore,
    @Inject(PaymentProvider) private readonly provider: PaymentProvider,
  ) {}
  async execute(raw: ProviderWebhook, correlationId: string) {
    const valid = this.provider.verifyWebhook(raw);
    const auditId = await this.store.audit(raw, valid);
    try {
      if (!valid) throw new PaymentProviderError('INVALID_SIGNATURE');
      // Only use the signed attempt ID for lookup; the adapter still validates the entire observation.
      let decoded: unknown;
      try {
        decoded = JSON.parse(Buffer.from(raw.data, 'base64').toString()) as unknown;
      } catch {
        throw new PaymentProviderError('INVALID_RESPONSE');
      }
      const fields = z
        .object({ order_id: z.string().uuid().optional(), paymentId: z.string().uuid().optional() })
        .safeParse(decoded);
      const id = fields.success ? (fields.data.order_id ?? fields.data.paymentId) : undefined;
      if (!id) throw new PaymentProviderError('INVALID_RESPONSE');
      const payment = await this.store.find(id);
      if (!payment) throw new PaymentError('PAYMENT_NOT_FOUND', 404);
      if (payment.provider !== readEnvironment().PAYMENT_PROVIDER.toUpperCase())
        throw new PaymentError('PROVIDER_NOT_ACTIVE', 409);
      const observation = this.provider.parseWebhook(raw, identity(payment));
      await this.store.observe(observation, correlationId);
      await this.store.auditOutcome(auditId, 'APPLIED', id);
      return { received: true };
    } catch (error) {
      const code =
        error instanceof PaymentProviderError || error instanceof PaymentError
          ? error.code
          : 'PAYMENTS_UNAVAILABLE';
      await this.store.auditOutcome(auditId, code);
      throw error;
    }
  }
}
