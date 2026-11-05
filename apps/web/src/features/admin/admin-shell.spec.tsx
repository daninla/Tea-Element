/** @jest-environment jsdom */
import { act, type ComponentProps } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminShell } from './admin-shell';
import { ordersApi } from '@/lib/api/orders';
jest.mock('next/navigation', () => ({ usePathname: () => '/admin/orders' }));
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: ComponentProps<'a'>) => <a {...props}>{children}</a>,
}));
jest.mock('@/lib/api/orders', () => ({ ordersApi: { me: jest.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
it('never renders administrative children for a customer even if client navigation reaches the shell', async () => {
  jest
    .mocked(ordersApi.me)
    .mockResolvedValue({ id: 'customer', role: 'CUSTOMER' } as Awaited<
      ReturnType<typeof ordersApi.me>
    >);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AdminShell>
            <p>private-order-details</p>
          </AdminShell>
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.textContent).not.toContain('private-order-details');
    expect(container.textContent).toContain('denied');
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  }
});

it('keeps unsaved fields mounted while an administrator session refreshes in the background', async () => {
  const user = { id: 'admin', role: 'ADMIN', firstName: 'Admin' } as Awaited<
    ReturnType<typeof ordersApi.me>
  >;
  let resolve!: (value: typeof user) => void;
  jest.mocked(ordersApi.me).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['customer-session'], user);
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <AdminShell>
            <input aria-label="unsaved" defaultValue="draft" />
          </AdminShell>
        </QueryClientProvider>,
      ),
    );
    const field = container.querySelector('input');
    expect(field).not.toBeNull();
    expect(client.isFetching()).toBe(1);
    await act(async () => {
      resolve(user);
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(container.querySelector('input')).toBe(field);
    expect(field?.value).toBe('draft');
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
  }
});
