'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { OrderView } from '@tea/contracts';
import { ordersApi } from '@/lib/api/orders';
import { authApi } from '@/lib/api/auth';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart, addCartItem } from '@/features/cart/cart-store';
import { ProfileForm } from './profile-form';
import { clearPrivateSession } from './auth-state';
export function AccountPage() {
  const t = useTranslations('account');
  const orderT = useTranslations('order');
  const router = useRouter();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const user = session.data;
  const history = useQuery({
    queryKey: ['account-orders', user?.id, page],
    queryFn: () => authApi.orders(page),
    enabled: !!user,
    retry: false,
    refetchInterval: 10000,
  });
  useEffect(() => {
    if (session.isSuccess && !session.data) router.replace('/login?next=/account');
  }, [session.isSuccess, session.data, router]);
  async function action(run: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setNotice(null);
    try {
      await run();
    } catch {
      setNotice('error');
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function repeat(order: OrderView) {
    const quote = await ordersApi.quote(
      order.items.map((x) => ({ variantId: x.variantId, quantity: x.quantity })),
    );
    if (quote.unavailableVariantIds.length || quote.items.some((x) => !x.inStock)) {
      setNotice('unavailable');
      return;
    }
    const current = useCart.getState().items;
    if (
      new Set([...current, ...quote.items].map((x) => x.variantId)).size > 50 ||
      quote.items.some(
        (x) => x.quantity + (current.find((c) => c.variantId === x.variantId)?.quantity ?? 0) > 99,
      )
    ) {
      setNotice('cartLimit');
      return;
    }
    let next = current;
    for (const item of quote.items) next = addCartItem(next, item.variantId, item.quantity);
    useCart.getState().replace(next);
    router.push('/cart');
  }
  if (session.isPending || (!user && !session.isError))
    return (
      <section className="container commerce-page">
        <p role="status">{t('loading')}</p>
      </section>
    );
  if (session.isError || !user)
    return (
      <section className="container commerce-page">
        <h1>{t('title.account')}</h1>
        <p role="alert">{t('error')}</p>
        <Link href="/login">{t('loginLink')}</Link>
      </section>
    );
  return (
    <section className="container commerce-page">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('welcome', { name: user.firstName })}</h1>
      <p>{user.email}</p>
      <div className="account-links">
        <Link href="/order-lookup">{t('lookupLink')}</Link>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await authApi.logout();
              await clearPrivateSession(client);
              router.replace('/login');
            })
          }
        >
          {t('logout')}
        </Button>
      </div>
      <div className="notice">
        <strong>{t(user.emailVerified ? 'emailVerified' : 'emailUnverified')}</strong>
        <p>{t('linkingHint')}</p>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              await authApi.requestEmail();
              setNotice('sent');
            })
          }
        >
          {t(user.emailVerified ? 'verifyAgain' : 'sendVerify')}
        </Button>
      </div>
      {notice && (
        <p
          className={notice === 'error' ? 'field-error' : 'notice'}
          role={notice === 'error' ? 'alert' : 'status'}
        >
          {t(notice)}
        </p>
      )}
      <div className="account-grid">
        <div>
          <h2>{t('orders')}</h2>
          {history.isPending ? (
            <p role="status">{t('loading')}</p>
          ) : history.isError ? (
            <>
              <p role="alert">{t('error')}</p>
              <Button variant="outline" onClick={() => void history.refetch()}>
                {t('refresh')}
              </Button>
            </>
          ) : !history.data?.items.length ? (
            <p>{t('emptyOrders')}</p>
          ) : (
            <>
              <ul className="account-orders">
                {history.data.items.map((order) => (
                  <li key={order.id}>
                    <div>
                      <Link className="text-link" href={`/order/${order.number}`}>
                        {order.number}
                      </Link>
                      <p>
                        {orderT(`status.${order.status}`)} · {formatMoney(order.total)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => void action(() => repeat(order))}
                    >
                      {t('repeat')}
                    </Button>
                  </li>
                ))}
              </ul>
              <nav aria-label={t('pagination')} className="account-links">
                <Button
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t('previous')}
                </Button>
                <span>
                  {page} / {history.data.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= history.data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('next')}
                </Button>
              </nav>
            </>
          )}
        </div>
        <ProfileForm key={user.id} user={user} />
      </div>
    </section>
  );
}
