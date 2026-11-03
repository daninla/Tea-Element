'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ordersApi } from '@/lib/api/orders';
import { useCart, storedCart, reconcileCart } from './cart-store';
import { z } from 'zod';
const mergeAttempt = z.object({
  userId: z.string().uuid(),
  key: z.string().uuid(),
  items: storedCart,
});
export function CartSession() {
  const t = useTranslations('cart');
  const session = useQuery({
    queryKey: ['customer-session'],
    queryFn: ordersApi.me,
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });
  const revision = useCart((s) => s.revision);
  const syncing = useRef(false);
  const synced = useRef(-1);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const initialized = useRef<string | null>(null);
  useEffect(() => {
    if (!session.isSuccess || syncing.current) return;
    const state = useCart.getState();
    const userId = session.data?.id ?? null;
    if (!userId) {
      initialized.current = null;
      if (state.ownerId) state.replace([], null);
      return;
    }
    if (initialized.current === userId && synced.current === state.revision) return;
    const targetRevision = state.revision;
    syncing.current = true;
    let before = state.items;
    let operation;
    if (initialized.current !== userId && state.ownerId === null) {
      let stored;
      try {
        stored = mergeAttempt.safeParse(
          JSON.parse(localStorage.getItem('tea-cart-merge') ?? 'null'),
        );
      } catch {
        stored = undefined;
      }
      const attempt =
        stored?.success && stored.data.userId === userId
          ? stored.data
          : { userId, key: crypto.randomUUID(), items: state.items };
      before = attempt.items;
      localStorage.setItem('tea-cart-merge', JSON.stringify(attempt));
      operation = ordersApi.merge(attempt.items, attempt.key);
    } else
      operation = initialized.current !== userId ? ordersApi.cart() : ordersApi.save(state.items);
    void operation
      .then((items) => {
        const current = useCart.getState();
        if (initialized.current !== userId) {
          current.replace(reconcileCart(items, before, current.items), userId);
          synced.current = current.revision === targetRevision ? useCart.getState().revision : -1;
          localStorage.removeItem('tea-cart-merge');
        } else if (current.revision === targetRevision) synced.current = targetRevision;
        initialized.current = userId;
        setFailed(false);
        setTick((t) => t + 1);
      })
      .catch(() => setFailed(true))
      .finally(() => {
        syncing.current = false;
      });
  }, [session.data, session.isSuccess, revision, tick]);
  return failed ? (
    <div className="cart-sync-notice" role="status">
      {t('syncError')}
    </div>
  ) : null;
}
