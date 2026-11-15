'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useCart } from '@/features/cart/cart-store';
import { useCartQuote } from '@/features/cart/use-cart-quote';
import { rememberAccess } from '@/features/payments/private-access';
import { checkoutDeliveryApi } from '@/lib/api/checkout-delivery';
import { DeliveryPointFields } from './delivery-point-fields';
import { checkoutSchema, type CheckoutFields } from './checkout-schema';
import { checkoutAttempt, fingerprintOrder } from './checkout-attempt';
export function CheckoutPage() {
  const t = useTranslations('checkout');
  const dt = useTranslations('checkoutDelivery');
  const cartT = useTranslations('cart');
  const router = useRouter();
  const quote = useCartQuote();
  const cart = useCart();
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const busy = useRef(false);
  const [review, setReview] = useState(false);
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const form = useForm<CheckoutFields>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      phone: '+380',
      email: '',
      delivery: { method: 'NOVA_POSHTA_BRANCH', city: '', address: '' },
      paymentMethod: 'CASH_ON_DELIVERY',
      comment: '',
      marketingConsent: false,
      acceptTerms: false,
    },
  });
  const method = form.watch('delivery.method');
  const selection = form.watch('delivery.selection');
  const paymentMethod = form.watch('paymentMethod');
  const carriers = useQuery({
    queryKey: ['delivery-carriers'],
    queryFn: checkoutDeliveryApi.carriers,
    retry: false,
  });
  const deliveryQuote = useQuery({
    queryKey: ['delivery-quote', selection, cart.items, paymentMethod, quote.data?.total],
    queryFn: () =>
      checkoutDeliveryApi.quote({ selection: selection!, items: cart.items, paymentMethod }),
    enabled: method === 'CARRIER_POINT' && !!selection && cart.items.length > 0 && !!quote.data,
    retry: false,
  });
  useEffect(() => {
    if (session.data) {
      for (const field of ['firstName', 'lastName', 'phone', 'email'] as const)
        if (!form.getFieldState(field).isDirty) form.setValue(field, session.data[field] ?? '');
      if (session.data.defaultDelivery && !form.getFieldState('delivery').isDirty)
        form.setValue('delivery', session.data.defaultDelivery);
    }
  }, [session.data, form]);
  async function submit(fields: CheckoutFields) {
    if (
      busy.current ||
      !quote.data ||
      (method === 'CARRIER_POINT' &&
        (!deliveryQuote.data || deliveryQuote.isFetching || deliveryQuote.isError))
    )
      return;
    busy.current = true;
    setLocked(true);
    setError(null);
    const items = useCart.getState().items;
    try {
      const fresh = await ordersApi.quote(items);
      if (fresh.unavailableVariantIds.length || fresh.items.some((x) => !x.inStock)) {
        setError(t('stockError'));
        await quote.refetch();
        return;
      }
      if (
        fresh.total !== quote.data.total ||
        JSON.stringify(fresh.items.map((x) => [x.variantId, x.unitPrice])) !==
          JSON.stringify(quote.data.items.map((x) => [x.variantId, x.unitPrice]))
      ) {
        setReview(true);
        await quote.refetch();
        return;
      }
      const input = {
        ...fields,
        items,
        acceptTerms: true as const,
        delivery:
          method === 'CARRIER_POINT'
            ? { ...fields.delivery, city: '', address: '' }
            : { ...fields.delivery, selection: undefined },
        ...(method === 'CARRIER_POINT' ? { expectedDeliveryTotal: deliveryQuote.data!.total } : {}),
      };
      const fingerprint = await fingerprintOrder(input);
      const { key } = checkoutAttempt(
        fingerprint,
        sessionStorage.getItem('tea-checkout-attempt'),
        () => crypto.randomUUID(),
      );
      sessionStorage.setItem('tea-checkout-attempt', JSON.stringify({ key, fingerprint }));
      const created = await ordersApi.create(input, key, !!session.data);
      rememberAccess(sessionStorage, created.order.number, created.accessToken);
      // Preserve any portions added in another tab while the request was in flight.
      const current = useCart.getState().items;
      if (JSON.stringify(current) === JSON.stringify(items)) cart.clear();
      sessionStorage.removeItem('tea-checkout-attempt');
      router.replace(
        `/order/${created.order.number}${created.order.paymentMethod === 'ONLINE_CARD' ? '/pay' : ''}?token=${encodeURIComponent(created.accessToken)}`,
      );
    } catch (e) {
      if (e instanceof OrdersApiError && e.code === 'DELIVERY_PRICE_CHANGED') {
        sessionStorage.removeItem('tea-checkout-attempt');
        await Promise.all([quote.refetch(), deliveryQuote.refetch()]);
        setError(dt('priceChanged'));
        return;
      }
      setError(
        e instanceof OrdersApiError && e.code === 'IDEMPOTENCY_CONFLICT'
          ? t('conflict')
          : e instanceof OrdersApiError && e.code === 'INSUFFICIENT_STOCK'
            ? t('stockError')
            : t('submitError'),
      );
    } finally {
      busy.current = false;
      setLocked(false);
    }
  }
  if (!quote.mounted)
    return (
      <section className="container commerce-page">
        <p role="status">{cartT('loading')}</p>
      </section>
    );
  if (!quote.items.length)
    return (
      <section className="container commerce-page">
        <h1>{t('title')}</h1>
        <p>{cartT('emptyText')}</p>
        <Link href="/catalog" className="text-link">
          {cartT('explore')}
        </Link>
      </section>
    );
  const invalidStock =
    quote.data &&
    (quote.data.unavailableVariantIds.length > 0 || quote.data.items.some((x) => !x.inStock));
  const errorFor = (invalid: boolean) =>
    invalid ? (
      <span className="field-error" role="alert">
        {t('invalidField')}
      </span>
    ) : null;
  return (
    <section className="container commerce-page">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <p className="commerce-intro">{t('guestHint')}</p>
      <p className="notice">{t('demo')}</p>
      <div className="checkout-grid">
        <form noValidate onSubmit={form.handleSubmit(submit)}>
          <fieldset disabled={locked}>
            <legend>{t('contacts')}</legend>
            <div className="form-grid">
              {(['firstName', 'lastName', 'phone', 'email'] as const).map((field) => (
                <label key={field} className="commerce-field">
                  {t(field)}
                  <input
                    {...form.register(field)}
                    autoComplete={
                      field === 'firstName'
                        ? 'given-name'
                        : field === 'lastName'
                          ? 'family-name'
                          : field === 'phone'
                            ? 'tel'
                            : 'email'
                    }
                    type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                    aria-invalid={!!form.formState.errors[field]}
                    maxLength={field === 'email' ? 320 : field === 'phone' ? 13 : 100}
                  />
                  {errorFor(!!form.formState.errors[field])}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset disabled={locked}>
            <legend>{t('delivery')}</legend>
            <label className="commerce-field">
              {t('deliveryMethod')}
              <select
                {...form.register('delivery.method', {
                  onChange: () => form.setValue('delivery.selection', undefined),
                })}
              >
                {!!carriers.data?.length && <option value="CARRIER_POINT">{dt('method')}</option>}
                <option value="NOVA_POSHTA_BRANCH">{t('branch')}</option>
                <option value="NOVA_POSHTA_COURIER">{t('courier')}</option>
                <option value="PICKUP">{t('pickup')}</option>
              </select>
            </label>
            {carriers.isError && <p role="alert">{dt('lookupError')}</p>}
            {method === 'CARRIER_POINT' && carriers.data?.length ? (
              <DeliveryPointFields
                carriers={carriers.data}
                change={(value) =>
                  form.setValue('delivery.selection', value, { shouldDirty: true })
                }
              />
            ) : method === 'PICKUP' ? (
              <p className="muted-copy">{t('pickupNote')}</p>
            ) : (
              <div className="form-grid">
                <label className="commerce-field">
                  {t('city')}
                  <input
                    {...form.register('delivery.city')}
                    autoComplete="address-level2"
                    aria-invalid={!!form.formState.errors.delivery?.city}
                  />
                  {errorFor(!!form.formState.errors.delivery?.city)}
                </label>
                <label className="commerce-field">
                  {method === 'NOVA_POSHTA_BRANCH' ? t('branchAddress') : t('streetAddress')}
                  <input
                    {...form.register('delivery.address')}
                    aria-invalid={!!form.formState.errors.delivery?.address}
                  />
                  {errorFor(!!form.formState.errors.delivery?.address)}
                </label>
              </div>
            )}
          </fieldset>
          <fieldset disabled={locked}>
            <legend>{t('payment')}</legend>
            <label className="payment-choice">
              <input type="radio" value="CASH_ON_DELIVERY" {...form.register('paymentMethod')} />
              <span>{t('cod')}</span>
            </label>
            <label className="payment-choice">
              <input type="radio" value="ONLINE_CARD" {...form.register('paymentMethod')} />
              <span>{t('online')}</span>
            </label>
            <p className="muted-copy">{t('paymentDemo')}</p>
            <label className="commerce-field">
              {t('comment')}
              <textarea {...form.register('comment')} maxLength={1000} rows={3} />
            </label>
          </fieldset>
          <fieldset className="consent-fields" disabled={locked}>
            <legend className="sr-only">{t('consents')}</legend>
            <label>
              <input type="checkbox" {...form.register('acceptTerms')} />
              <span>
                {t('terms')} <Link href="/terms">{t('termsLink')}</Link>
              </span>
            </label>
            {errorFor(!!form.formState.errors.acceptTerms)}
            <label>
              <input type="checkbox" {...form.register('marketingConsent')} />
              <span>{t('marketing')}</span>
            </label>
          </fieldset>
          {error && (
            <p className="notice field-error" role="alert">
              {error}
            </p>
          )}
          {review && (
            <p className="notice" role="alert">
              {t('reviewPrices')}
            </p>
          )}
          <Button
            type="submit"
            disabled={
              locked ||
              !quote.data ||
              quote.isFetching ||
              !!invalidStock ||
              session.isPending ||
              (method === 'CARRIER_POINT' &&
                (!selection ||
                  !deliveryQuote.data ||
                  deliveryQuote.isFetching ||
                  deliveryQuote.isError))
            }
          >
            {locked ? t('submitting') : review ? t('confirmUpdated') : t('submit')}
          </Button>
        </form>
        <aside className="checkout-summary">
          <h2>{t('summary')}</h2>
          {quote.isError ? (
            <>
              <p role="alert">{cartT('error')}</p>
              <Button onClick={() => void quote.refetch()}>{cartT('retry')}</Button>
            </>
          ) : !quote.data ? (
            <p role="status">{cartT('loading')}</p>
          ) : (
            <>
              <ul>
                {quote.data.items.map((x) => (
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
                  <span>{formatMoney(quote.data.subtotal)}</span>
                </p>
                <p>
                  <span>{cartT('discount')}</span>
                  <span>−{formatMoney(quote.data.discount)}</span>
                </p>
                {method === 'CARRIER_POINT' && (
                  <p>
                    <span>{dt('fee')}</span>
                    <span>
                      {deliveryQuote.isFetching
                        ? dt('loading')
                        : deliveryQuote.isError
                          ? dt('quoteError')
                          : deliveryQuote.data
                            ? formatMoney(deliveryQuote.data.fee)
                            : dt('selectPoint')}
                    </span>
                  </p>
                )}
                <p className="cart-grand-total">
                  <span>{cartT('total')}</span>
                  <strong>
                    {method === 'CARRIER_POINT'
                      ? deliveryQuote.data && !deliveryQuote.isFetching && !deliveryQuote.isError
                        ? formatMoney(deliveryQuote.data.total)
                        : '—'
                      : formatMoney(quote.data.total)}
                  </strong>
                </p>
                <small>
                  {method === 'CARRIER_POINT' ? dt('estimateNote') : cartT('deliveryNote')}
                </small>
              </div>
              {invalidStock && (
                <p role="alert" className="field-error">
                  {t('stockError')}
                </p>
              )}
            </>
          )}
          <Link href="/cart" className="text-link">
            {t('backToCart')}
          </Link>
        </aside>
      </div>
    </section>
  );
}
