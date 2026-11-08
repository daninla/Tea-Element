import type { QueryClient } from '@tanstack/react-query';
import { useCart } from '@/features/cart/cart-store';
export async function clearPrivateSession(client: QueryClient) {
  await client.cancelQueries();
  client.clear();
  client.setQueryData(['customer-session'], null);
  useCart.getState().replace([], null);
  try {
    localStorage.removeItem('tea-cart-merge');
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (
        key &&
        (key.startsWith('tea-order-access:') ||
          key.startsWith('tea-payment-command:') ||
          key.startsWith('tea-order-command:') ||
          key.startsWith('tea-inventory-command:') ||
          key.startsWith('tea-catalog-command:') ||
          key.startsWith('tea-campaign-command:') ||
          key === 'tea-checkout-attempt')
      )
        sessionStorage.removeItem(key);
    }
  } catch {
    /* Cached private data is cleared even if browser storage is unavailable. */
  }
}
