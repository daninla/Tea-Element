/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AdminOrderDetail } from '@tea/contracts';
import { AdminOrderCancellation, canCancelAdminOrder } from './admin-order-cancellation';
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it('distinguishes an accepted cancellation from a confirmed full refund and hides cancellation after shipment', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container),
    client = new QueryClient();
  const order = {
    id: 'order',
    number: 'TE-demo',
    status: 'PAID',
    paymentMethod: 'ONLINE_CARD',
    paymentStatus: 'PAID',
    stockDeductedAt: null,
  } as AdminOrderDetail;
  const render = async (x: AdminOrderDetail) =>
    act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AdminOrderCancellation order={x} actorId="admin" />
        </QueryClientProvider>,
      ),
    );
  try {
    expect(canCancelAdminOrder(order)).toBe(true);
    await render(order);
    expect(container.textContent).toContain('cancelOnlineHint');
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(
      false,
    );
    await render({ ...order, status: 'CANCELLED' });
    expect(container.textContent).toContain('refundPending');
    expect(container.querySelector('form')).toBeNull();
    await render({ ...order, status: 'CANCELLED', paymentStatus: 'REFUNDED' });
    expect(container.textContent).toContain('refundDone');
    await render({ ...order, status: 'SHIPPED' });
    expect(container.textContent).toBe('');
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  }
});
