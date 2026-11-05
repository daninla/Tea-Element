'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { inventoryAttempt, PendingInventoryOperation } from './inventory-attempt';
export function useCatalogSave(scope: string) {
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [uncertain, setUncertain] = useState(false);
  const storage = `tea-catalog-command:${session.data?.id}:${scope}`;
  const gate = useRef(false);
  useEffect(() => {
    try {
      setUncertain(!!sessionStorage.getItem(storage));
    } catch {
      setMessage('pending');
    }
  }, [storage]);
  async function save<T>(
    intent: unknown,
    action: (key: string) => Promise<T>,
  ): Promise<T | undefined> {
    if (gate.current || session.data?.role !== 'ADMIN') return;
    gate.current = true;
    setBusy(true);
    setMessage('');
    try {
      const attempt = await inventoryAttempt(intent, sessionStorage.getItem(storage), () =>
        crypto.randomUUID(),
      );
      sessionStorage.setItem(storage, JSON.stringify(attempt));
      const result = await action(attempt.key);
      sessionStorage.removeItem(storage);
      setUncertain(false);
      setMessage('saved');
      return result;
    } catch (e) {
      if (e instanceof PendingInventoryOperation) {
        setUncertain(true);
        setMessage('pending');
      } else if (e instanceof OrdersApiError && e.status >= 400 && e.status < 500) {
        sessionStorage.removeItem(storage);
        setUncertain(false);
        setMessage(
          e.code === 'STALE_CATALOG'
            ? 'stale'
            : e.code === 'CATALOG_CONFLICT'
              ? 'conflict'
              : e.code === 'IMMUTABLE_FIELD'
                ? 'immutable'
                : 'invalid',
        );
      } else {
        setUncertain(true);
        setMessage('pending');
      }
      return undefined;
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  function reviewed() {
    sessionStorage.removeItem(storage);
    setUncertain(false);
    setMessage('');
  }
  return { save, busy, message, uncertain, reviewed };
}
