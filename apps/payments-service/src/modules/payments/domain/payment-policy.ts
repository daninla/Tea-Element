import type { ProviderStatus } from './payment-provider';
export function paymentTransition(current: string, observed: ProviderStatus): string {
  if (observed === 'PENDING' || observed === 'REFUND_PENDING') return current;
  if (current === 'REFUNDED') return current;
  if (observed === 'REFUNDED') return 'REFUNDED';
  if (current === 'PARTIALLY_REFUNDED') return current;
  if (observed === 'PARTIALLY_REFUNDED') return 'PARTIALLY_REFUNDED';
  // Late success is real money, even after expiry/failure; cancellation then requires a refund.
  if (observed === 'SUCCEEDED') return 'SUCCEEDED';
  return ['CREATED', 'PENDING'].includes(current) ? 'FAILED' : current;
}
