/** @jest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthPage } from './auth-page';
import { authApi } from '@/lib/api/auth';
jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
jest.mock('@/lib/api/orders', () => ({ ordersApi: { me: async () => null } }));
jest.mock('@/lib/api/auth', () => ({ authApi: { confirmEmail: jest.fn() } }));
jest.mock('@/features/payments/use-private-access', () => ({
  usePrivateAccess: () => ({ ready: true }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root, container: HTMLDivElement, client: QueryClient;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  container.remove();
  window.location.hash = '';
});
it('requires an explicit confirmation action instead of consuming a proof on page load', async () => {
  window.location.hash = '#token=test-email-proof';
  jest.mocked(authApi.confirmEmail).mockResolvedValue({ confirmed: true });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <AuthPage mode="verify" />
      </QueryClientProvider>,
    ),
  );
  expect(authApi.confirmEmail).not.toHaveBeenCalled();
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
  expect(authApi.confirmEmail).toHaveBeenCalledWith('test-email-proof');
  expect(container.textContent).toContain('verified');
});
it('rejects an absent proof without calling the confirmation endpoint', async () => {
  jest.mocked(authApi.confirmEmail).mockClear();
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <AuthPage mode="verify" />
      </QueryClientProvider>,
    ),
  );
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
  expect(authApi.confirmEmail).not.toHaveBeenCalled();
  expect(container.querySelector('[role=alert]')!.textContent).toBe('invalid');
});
