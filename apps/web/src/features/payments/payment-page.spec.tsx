/** @jest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentPage, HostedPayment } from './payment-page';
import { ordersApi } from '@/lib/api/orders';
import { paymentsApi } from '@/lib/api/payments';
let mockSearch = 'token=' + 'A'.repeat(43);
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ replace: mockReplace }),
}));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
jest.mock('@/lib/api/orders', () => ({
  ordersApi: { me: jest.fn(), get: jest.fn() },
  OrdersApiError: class extends Error {},
}));
jest.mock('@/lib/api/payments', () => ({
  paymentsApi: { checkout: jest.fn(), simulate: jest.fn(), change: jest.fn() },
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const order = {
  id: 'order',
  number: 'TE-one',
  status: 'AWAITING_PAYMENT',
  paymentMethod: 'ONLINE_CARD',
  paymentStatus: 'UNPAID',
  paymentAttemptId: 'attempt',
  total: 100,
  paymentExpiresAt: '2099-01-01T00:00:00Z',
};
describe('payment result UI trust boundary', () => {
  let root: Root, container: HTMLDivElement, client: QueryClient;
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: () => '11111111-1111-4111-8111-111111111111',
    });
    mockSearch = 'token=' + 'A'.repeat(43);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    jest.mocked(ordersApi.me).mockResolvedValue(null);
    jest.mocked(ordersApi.get).mockResolvedValue(order as never);
    jest.mocked(paymentsApi.checkout).mockResolvedValue({
      payment: { id: 'attempt' },
      checkout: { provider: 'FAKE', paymentId: 'attempt' },
    } as never);
  });
  afterEach(() => {
    act(() => root.unmount());
    client.clear();
    container.remove();
  });
  async function render(view = <PaymentPage number="TE-one" result />) {
    await act(async () => {
      root.render(<QueryClientProvider client={client}>{view}</QueryClientProvider>);
    });
    for (let i = 0; i < 4; i++)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0));
      });
  }
  it('ignores forged success query parameters and waits for server confirmation', async () => {
    mockSearch += '&status=success&paid=true';
    await render();
    expect(container.textContent).toContain('checking');
    expect(container.textContent).toContain('simulateSuccess');
    expect(container.querySelector('h1')?.textContent).not.toBe('success');
  });
  it('shows confirmation only for the persisted PAID order state', async () => {
    jest.mocked(ordersApi.get).mockResolvedValue({ ...order, status: 'PAID' } as never);
    await render();
    expect(container.querySelector('h1')?.textContent).toBe('success');
    expect(container.textContent).not.toContain('simulateSuccess');
  });
  it('restores private access after a provider return without a URL bearer', async () => {
    sessionStorage.setItem('tea-order-access:TE-one', 'B'.repeat(43));
    mockSearch = '';
    await render();
    expect(ordersApi.get).toHaveBeenCalledWith('TE-one', 'B'.repeat(43));
  });
  it('does not show a payment simulator when order access is rejected', async () => {
    jest.mocked(ordersApi.get).mockRejectedValue(new Error('denied'));
    await render();
    expect(container.textContent).toContain('privateError');
    expect(paymentsApi.checkout).not.toHaveBeenCalled();
    expect(container.textContent).not.toContain('simulateSuccess');
  });
  it('prevents duplicate retry commands while a request is in flight', async () => {
    jest.mocked(ordersApi.get).mockResolvedValue({ ...order, paymentStatus: 'FAILED' } as never);
    jest.mocked(paymentsApi.change).mockImplementation(() => new Promise(() => {}));
    await render();
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'retry',
    )!;
    act(() => {
      button.click();
      button.click();
    });
    expect(paymentsApi.change).toHaveBeenCalledTimes(1);
  });
  it('finishes with a private-access error instead of loading forever if auth is unavailable', async () => {
    mockSearch = '';
    jest.mocked(ordersApi.me).mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(container.textContent).toContain('privateError');
  });
  it('posts only signed provider fields and preserves the guest token locally', async () => {
    const submitted = jest
      .spyOn(HTMLFormElement.prototype, 'requestSubmit')
      .mockImplementation(function (this: HTMLFormElement) {
        this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      });
    try {
      await render(
        <HostedPayment
          descriptor={
            {
              payment: { id: 'hosted-attempt' },
              checkout: {
                provider: 'LIQPAY',
                method: 'POST',
                actionUrl: 'https://www.liqpay.ua/api/3/checkout',
                fields: { data: 'signed-data', signature: 'signed-signature' },
              },
            } as never
          }
          number="TE-one"
          token={'A'.repeat(43)}
          onStorageError={() => {}}
        />,
      );
      expect(submitted).toHaveBeenCalledTimes(1);
      expect(Array.from(container.querySelectorAll('input')).map((x) => x.name)).toEqual([
        'data',
        'signature',
      ]);
      expect(sessionStorage.getItem('tea-order-access:TE-one')).toBe('A'.repeat(43));
    } finally {
      submitted.mockRestore();
    }
  });
  it('never builds a hosted form for an unexpected payment destination', async () => {
    await render(
      <HostedPayment
        descriptor={
          {
            payment: { id: 'attempt' },
            checkout: {
              provider: 'LIQPAY',
              method: 'POST',
              actionUrl: 'https://other.example',
              fields: { data: 'd', signature: 's' },
            },
          } as never
        }
        number="TE-one"
        onStorageError={() => {}}
      />,
    );
    expect(container.querySelector('form')).toBeNull();
  });
});
