/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InventoryItem } from '@tea/contracts';
import { InventoryCommandForm } from './inventory-command-form';
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const item = { productId: 'product', unit: 'GRAM', stock: 100, reserved: 20 } as InventoryItem;
it('requires renewed confirmation when the displayed physical balance changes', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <InventoryCommandForm item={item} actorId="admin" mode="ADJUST" />
        </QueryClientProvider>,
      ),
    );
    const checkbox = container.querySelector('input[type=checkbox]') as HTMLInputElement;
    await act(async () => checkbox.click());
    expect(checkbox.checked).toBe(true);
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <InventoryCommandForm item={{ ...item, stock: 101 }} actorId="admin" mode="ADJUST" />
        </QueryClientProvider>,
      ),
    );
    expect(checkbox.checked).toBe(false);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    sessionStorage.clear();
  }
});
it('clears old form values before allowing a new operation after review of an uncertain result', async () => {
  sessionStorage.setItem('tea-inventory-command:admin:product:PURCHASE', '{}');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const client = new QueryClient();
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <InventoryCommandForm item={item} actorId="admin" mode="PURCHASE" />
        </QueryClientProvider>,
      ),
    );
    const quantity = container.querySelector('input[inputmode=numeric]') as HTMLInputElement;
    quantity.value = '100';
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type=checkbox]');
    await act(async () => {
      checkboxes[0]!.click();
      checkboxes[1]!.click();
    });
    const button = Array.from(container.querySelectorAll('button')).find(
      (x) => x.textContent === 'newOperation',
    )!;
    await act(async () => button.click());
    expect(quantity.value).toBe('');
    expect(checkboxes[0]!.checked).toBe(false);
    expect(sessionStorage.getItem('tea-inventory-command:admin:product:PURCHASE')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    sessionStorage.clear();
  }
});
