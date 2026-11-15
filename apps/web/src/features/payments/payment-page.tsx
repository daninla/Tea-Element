'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { OrderView, PaymentCheckoutView } from '@tea/contracts';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { paymentsApi } from '@/lib/api/payments';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePrivateAccess } from './use-private-access';
import { rememberAccess, paymentCommandKey } from './private-access';
export function PaymentPage({ number, result = false }: { number: string; result?: boolean }) {
  const t = useTranslations('payment');
  const router = useRouter();
  const client = useQueryClient();
  const { token, ready } = usePrivateAccess(number);
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const key = ['payment-order', number, token, token ? 'bearer' : (session.data?.id ?? null)];
  const order = useQuery({
    queryKey: key,
    queryFn: () => ordersApi.get(number, token),
    enabled: ready && (!!token || session.isSuccess),
    retry: false,
    refetchInterval: (q) =>
      ['PENDING', 'AWAITING_PAYMENT'].includes(q.state.data?.status ?? '') ? 1500 : false,
  });
  const current = order.data;
  const form = useQuery({
    queryKey: ['payment-form', number, current?.paymentAttemptId, token],
    queryFn: () => paymentsApi.checkout(number, token),
    enabled:
      !!current && current.status === 'AWAITING_PAYMENT' && current.paymentStatus !== 'FAILED',
    retry: (count, e) => e instanceof OrdersApiError && e.code === 'PAYMENT_NOT_READY' && count < 8,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
  });
  const back = `/order/${number}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  async function action(run: () => Promise<void>) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      await run();
    } catch {
      setError(t('actionError'));
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function simulate(outcome: 'SUCCEEDED' | 'FAILED') {
    await paymentsApi.simulate(number, token, outcome);
    await order.refetch();
    let saved = !token;
    try {
      if (token) saved = rememberAccess(sessionStorage, number, token);
    } catch {
      /* Keep URL access if storage is unavailable. */
    }
    router.replace(
      `/order/${number}/result${!saved && token ? `?token=${encodeURIComponent(token)}` : ''}`,
    );
  }
  async function change(kind: 'RETRY' | 'COD') {
    const command = paymentCommandKey(
      sessionStorage,
      number,
      current?.paymentAttemptId ?? 'none',
      kind,
      () => crypto.randomUUID(),
    );
    const changed = await paymentsApi.change(number, token, kind, command);
    client.setQueryData<OrderView>(key, changed);
    if (kind === 'COD') router.replace(back);
    else {
      await client.invalidateQueries({ queryKey: ['payment-form', number] });
      router.replace(`/order/${number}/pay${token ? `?token=${encodeURIComponent(token)}` : ''}`);
    }
  }
  const accessUnavailable = ready && !token && session.isError;
  if (!accessUnavailable && (!ready || session.isPending || order.isPending))
    return (
      <section className="container commerce-page">
        <p role="status">{t('loading')}</p>
      </section>
    );
  if (accessUnavailable || order.isError || !current)
    return (
      <section className="container commerce-page">
        <h1>{t('privateTitle')}</h1>
        <p>{t('privateError')}</p>
        <Link href="/catalog" className="text-link">
          {t('catalog')}
        </Link>
      </section>
    );
  const paid = current.status === 'PAID';
  const awaiting = current.status === 'AWAITING_PAYMENT';
  const failed = awaiting && current.paymentStatus === 'FAILED';
  const title = paid
    ? t('success')
    : failed
      ? t('failed')
      : current.status === 'CANCELLED' || current.status === 'REJECTED'
        ? t('cancelled')
        : current.paymentMethod === 'CASH_ON_DELIVERY'
          ? t('codConfirmed')
          : t(result ? 'checking' : 'preparing');
  return (
    <section className="container commerce-page payment-page">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{title}</h1>
      <p className="order-number">{number}</p>
      <p className="notice">{t('demo')}</p>
      <div className="payment-panel" aria-busy={busy}>
        <p className="payment-total">
          {t('total')} <strong>{formatMoney(current.total)}</strong>
        </p>
        {paid ? (
          <p role="status">{t('successText')}</p>
        ) : failed ? (
          <p role="status">{t('failureText')}</p>
        ) : current.status === 'PENDING' ? (
          <p role="status">{t('reserving')}</p>
        ) : awaiting ? (
          <>
            <p role="status">{t('waitingText')}</p>
            {current.paymentExpiresAt && (
              <p className="muted-copy">
                {t('deadline', {
                  time: new Intl.DateTimeFormat('uk-UA', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Kyiv',
                  }).format(new Date(current.paymentExpiresAt)),
                })}
              </p>
            )}
            {form.isPending ? (
              <p role="status">{t('loading')}</p>
            ) : form.isError ? (
              <>
                <p role="alert">{t('prepareError')}</p>
                <Button onClick={() => void form.refetch()}>{t('refresh')}</Button>
              </>
            ) : form.data?.checkout.provider === 'FAKE' ? (
              <>
                <h2>{t('fakeTitle')}</h2>
                <p>{t('fakeText')}</p>
                <div className="payment-actions">
                  <Button disabled={busy} onClick={() => void action(() => simulate('SUCCEEDED'))}>
                    {t('simulateSuccess')}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void action(() => simulate('FAILED'))}
                  >
                    {t('simulateFailure')}
                  </Button>
                </div>
              </>
            ) : form.data ? (
              <HostedPayment
                descriptor={form.data}
                number={number}
                token={token}
                onStorageError={() => setError(t('storageError'))}
              />
            ) : null}
          </>
        ) : (
          <p>{t(current.paymentMethod === 'CASH_ON_DELIVERY' ? 'codText' : 'cancelledText')}</p>
        )}
        {awaiting && (
          <div className="payment-actions">
            {failed && (
              <Button disabled={busy} onClick={() => void action(() => change('RETRY'))}>
                {t('retry')}
              </Button>
            )}
            {current.delivery?.method !== 'CARRIER_POINT' && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void action(() => change('COD'))}
              >
                {t('switchCod')}
              </Button>
            )}
          </div>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <Link className="text-link" href={back}>
          {t('order')}
        </Link>
      </div>
    </section>
  );
}
export function HostedPayment({
  descriptor,
  number,
  token,
  onStorageError,
}: {
  descriptor: PaymentCheckoutView;
  number: string;
  token?: string;
  onStorageError: () => void;
}) {
  const t = useTranslations('payment');
  const [leaving, setLeaving] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  const form = descriptor.checkout;
  useEffect(() => {
    if (form.provider !== 'LIQPAY' || form.actionUrl !== 'https://www.liqpay.ua/api/3/checkout')
      return;
    try {
      const key = `tea-hosted-redirect:${descriptor.payment.id}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
      ref.current?.requestSubmit();
    } catch {
      onStorageError();
    }
  }, [descriptor.payment.id, form, onStorageError]);
  if (
    form.provider !== 'LIQPAY' ||
    form.actionUrl !== 'https://www.liqpay.ua/api/3/checkout' ||
    form.method !== 'POST'
  )
    return null;
  return (
    <form
      ref={ref}
      action={form.actionUrl}
      method="POST"
      onSubmit={(event) => {
        if (leaving) {
          event.preventDefault();
          return;
        }
        if (token) {
          try {
            if (!rememberAccess(sessionStorage, number, token)) {
              event.preventDefault();
              onStorageError();
              return;
            }
          } catch {
            event.preventDefault();
            onStorageError();
            return;
          }
        }
        setLeaving(true);
      }}
    >
      <input type="hidden" name="data" value={form.fields.data} />
      <input type="hidden" name="signature" value={form.fields.signature} />
      <p className="muted-copy">{t('hostedText')}</p>
      <Button disabled={leaving} type="submit">
        {t(leaving ? 'redirecting' : 'hostedPay')}
      </Button>
    </form>
  );
}
