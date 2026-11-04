import type { ProviderWebhook } from './payment-provider';
export abstract class PaymentSimulator {
  abstract settle(id: string, status: 'SUCCEEDED' | 'FAILED'): ProviderWebhook;
}
