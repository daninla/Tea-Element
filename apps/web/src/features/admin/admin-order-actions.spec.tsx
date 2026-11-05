/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminOrderDetail } from '@tea/contracts';
import { AdminOrderActions, transitionFields } from './admin-order-actions';
import { adminApi } from '@/lib/api/admin';
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/api/admin', () => ({ adminApi: { transition: jest.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it('requires an explicit confirmation and a meaningful reason', () => {
  expect(transitionFields.safeParse({ reason: 'sent', confirmed: false }).success).toBe(false);
  expect(transitionFields.safeParse({ reason: '  ', confirmed: true }).success).toBe(false);
  expect(transitionFields.safeParse({ reason: 'sent', confirmed: true }).success).toBe(true);
});
it('withholds completion while the warehouse acknowledgement is pending', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  const order = {
    id: 'order',
    number: 'TE-demo',
    status: 'SHIPPED',
    paymentMethod: 'CASH_ON_DELIVERY',
    paymentStatus: 'UNPAID',
    stockDeductedAt: null,
  } as AdminOrderDetail;
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AdminOrderActions order={order} />
        </QueryClientProvider>,
      ),
    );
    expect(container.textContent).toContain('stockPending');
    expect(container.querySelector('form')).toBeNull();
    expect(adminApi.transition).not.toHaveBeenCalled();
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AdminOrderActions order={{ ...order, stockDeductedAt: new Date().toISOString() }} />
        </QueryClientProvider>,
      ),
    );
    expect(container.textContent).toContain('completeCodHint');
    expect(container.querySelector('form')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  }
});
