import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '@/lib/api/orders';
import { useCart } from './cart-store';
import { useMounted } from './use-mounted';
export function useCartQuote() {
  const items = useCart((s) => s.items);
  const mounted = useMounted();
  const previous = useRef<string | null>(null);
  const [changed, setChanged] = useState(false);
  const query = useQuery({
    queryKey: ['cart-quote', items],
    queryFn: () => ordersApi.quote(items),
    enabled: mounted && items.length > 0,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
  useEffect(() => {
    if (!query.data) return;
    const prices = JSON.stringify(query.data.items.map((x) => [x.variantId, x.unitPrice]));
    if (previous.current !== null && previous.current !== prices) setChanged(true);
    previous.current = prices;
  }, [query.data]);
  return { ...query, items, mounted, changed };
}
