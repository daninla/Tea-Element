import type { PaymentCheckoutView, PaymentView, OrderView } from '@tea/contracts';
import { request } from './orders';
export const paymentsApi = {
  checkout: (number: string, token?: string) =>
    request<PaymentCheckoutView>('/payments/checkout', 'POST', { number, token }),
  status: (number: string, token?: string) =>
    request<PaymentView>(
      `/payments/status?${new URLSearchParams({ number, ...(token ? { token } : {}) })}`,
    ),
  simulate: (number: string, token: string | undefined, outcome: 'SUCCEEDED' | 'FAILED') =>
    request<{ received: true }>('/payments/simulate', 'POST', { number, token, outcome }),
  change: (number: string, token: string | undefined, action: 'RETRY' | 'COD', key: string) =>
    request<OrderView>(
      `/orders/${encodeURIComponent(number)}/payment/${action === 'RETRY' ? 'retry' : 'cod'}${token ? `?token=${encodeURIComponent(token)}` : ''}`,
      'POST',
      {},
      key,
    ),
};
