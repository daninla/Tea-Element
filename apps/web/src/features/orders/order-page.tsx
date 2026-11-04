'use client';
import Link from 'next/link';
import { usePrivateAccess } from '@/features/payments/use-private-access';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
export function OrderPage({ number }: { number: string }) {
  const { token, ready } = usePrivateAccess(number);
  const t = useTranslations('order');
  const cartT = useTranslations('cart');
  const accountT = useTranslations('account');
  const client = useQueryClient();
  const [cancelError, setCancelError] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const key = ['private-order', number, token, token ? 'bearer' : (session.data?.id ?? null)];
  const query = useQuery({
    queryKey: key,
    queryFn: () => ordersApi.get(number, token),
    retry: false,
    enabled: ready && (!!token || session.isSuccess),
    refetchInterval: (q) => (q.state.data?.status === 'PENDING' ? 1000 : 10000),
  });
  async function cancel() {
    setCancelling(true);
    setCancelError(false);
    try {
      const order = await ordersApi.cancel(number, token);
      client.setQueryData(key, order);
    } catch {
      setCancelError(true);
    } finally {
      setCancelling(false);
    }
  }
  if (query.isPending)
    return (
      <section className="container commerce-page">
        <p role="status">{t('loading')}</p>
      </section>
    );
  if (query.isError || !query.data)
    return (
      <section className="container commerce-page">
        <h1>{t('notFound')}</h1>
        <p>
          {query.error instanceof OrdersApiError && query.error.status === 404
            ? t('privateAccess')
            : t('loadError')}
        </p>
        <Button onClick={() => void query.refetch()}>{cartT('retry')}</Button>
        <Link href="/catalog" className="text-link">
          {cartT('explore')}
        </Link>
      </section>
    );
  const order = query.data;
  return (
    <section className="container commerce-page">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>
        {order.status === 'PENDING' || order.status === 'CONFIRMED' ? t('thanks') : t('title')}
      </h1>
      <p className="order-number">{order.number}</p>
      <div className="order-status" role="status">
        <strong>{t(`status.${order.status}`)}</strong>
        <p>{t(`explanation.${order.status}`)}</p>
      </div>
      <p className="muted-copy">{t('emailNote', { email: order.email })}</p>
      <div className="checkout-grid">
        <div>
          <h2>{t('items')}</h2>
          <ul className="order-items">
            {order.items.map((x) => (
              <li key={x.variantId}>
                <span>
                  {x.name}
                  <small>
                    {x.weightGrams === null
                      ? cartT('piece')
                      : cartT('portion', { weight: x.weightGrams })}{' '}
                    × {x.quantity}
                  </small>
                </span>
                <strong>{formatMoney(x.unitPrice * x.quantity)}</strong>
              </li>
            ))}
          </ul>
          <div className="cart-totals">
            <p>
              <span>{cartT('subtotal')}</span>
              <span>{formatMoney(order.subtotal)}</span>
            </p>
            <p>
              <span>{cartT('discount')}</span>
              <span>−{formatMoney(order.discount)}</span>
            </p>
            <p className="cart-grand-total">
              <span>{cartT('total')}</span>
              <strong>{formatMoney(order.total)}</strong>
            </p>
          </div>
          <h2>{t('history')}</h2>
          <ol className="order-history">
            {order.history.map((h, i) => (
              <li key={i}>{t(`status.${h.status}`)}</li>
            ))}
          </ol>
        </div>
        <aside className="checkout-summary">
          <h2>{t('delivery')}</h2>
          <p>
            {order.firstName} {order.lastName}
          </p>
          <p>{order.phone}</p>
          <p>{t(`deliveryMethod.${order.delivery.method}`)}</p>
          {order.delivery.method !== 'PICKUP' && (
            <p>
              {order.delivery.city}, {order.delivery.address}
            </p>
          )}
          <p className="muted-copy">{cartT('deliveryNote')}</p>
          <h3>{t('payment')}</h3>
          <p>{t(order.paymentMethod === 'ONLINE_CARD' ? 'online' : 'cod')}</p>
          {order.status === 'AWAITING_PAYMENT' && (
            <Link
              className="button button-primary"
              href={`/order/${order.number}/pay${token ? `?token=${encodeURIComponent(token)}` : ''}`}
            >
              {t('continuePayment')}
            </Link>
          )}
          {token && !session.data && (
            <Link className="text-link" href={`/register?order=${order.number}`}>
              {accountT('fromOrderLink')}
            </Link>
          )}
          {token && (
            <>
              <h3>{t('tracking')}</h3>
              <p className="muted-copy">{t('privateLink')}</p>
              <a
                className="text-link"
                href={`/order/${order.number}?token=${encodeURIComponent(token)}`}
              >
                {t('trackingLink')}
              </a>
            </>
          )}
          {['PENDING', 'CONFIRMED', 'AWAITING_PAYMENT'].includes(order.status) && (
            <Button variant="outline" disabled={cancelling} onClick={() => void cancel()}>
              {cancelling ? t('cancelling') : t('cancel')}
            </Button>
          )}
          {cancelError && (
            <p role="alert" className="field-error">
              {t('cancelError')}
            </p>
          )}
        </aside>
      </div>
      <Link className="text-link" href="/catalog">
        {cartT('explore')}
      </Link>
    </section>
  );
}
