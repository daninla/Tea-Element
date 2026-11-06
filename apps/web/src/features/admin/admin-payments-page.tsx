'use client';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { PAYMENT_STATUSES } from '@tea/contracts';
import { paymentAdminApi } from '@/lib/api/payment-admin';
import { Button } from '@/components/ui/button';
import { AdminTable } from './admin-table';
import { parsePaymentFilters, paymentFilterFields, paymentMoney } from './payment-admin-filters';
export function AdminPaymentsPage() {
  const t = useTranslations('paymentAdmin'),
    p = useSearchParams(),
    router = useRouter(),
    input = parsePaymentFilters(new URLSearchParams(p));
  const list = useQuery({
    queryKey: ['admin-payments', p.toString()],
    queryFn: () => paymentAdminApi.list(input!),
    enabled: !!input,
    retry: false,
  });
  function page(n: number) {
    const q = new URLSearchParams(p);
    q.set('page', String(n));
    router.push('/admin/payments?' + q);
  }
  const back = '/admin/payments' + (p.size ? '?' + p : '');
  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <Link className="text-link" href="/admin/payments/events">
        {t('allEvents')}
      </Link>
      <PaymentFilters key={p.toString()} />
      {!input ? (
        <p role="alert">{t('invalidFilters')}</p>
      ) : list.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : list.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        list.data && (
          <>
            <p>{t('found', { count: list.data.total })}</p>
            <AdminTable
              caption={t('title')}
              headings={[
                t('attempt'),
                t('created'),
                t('status'),
                t('amount'),
                t('provider'),
                t('refund'),
              ]}
            >
              {list.data.items.map((x) => (
                <tr key={x.id}>
                  <th scope="row">
                    <Link
                      href={'/admin/payments/' + x.id + '?returnTo=' + encodeURIComponent(back)}
                    >
                      {x.orderNumber}
                    </Link>
                    <small>{x.id}</small>
                  </th>
                  <td>
                    {new Date(x.createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}
                  </td>
                  <td>{t('states.' + x.status)}</td>
                  <td className="admin-numeric">{paymentMoney(x.amount, x.currency)}</td>
                  <td>{x.provider}</td>
                  <td>{x.refundStatus ? t('refundStates.' + x.refundStatus) : t('none')}</td>
                </tr>
              ))}
            </AdminTable>
            {!list.data.items.length && <p>{t('empty')}</p>}
            <nav className="account-links" aria-label={t('pagination')}>
              <Button
                variant="outline"
                disabled={input.page <= 1}
                onClick={() => page(input.page - 1)}
              >
                {t('previous')}
              </Button>
              <span>
                {input.page} / {list.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={input.page >= list.data.totalPages}
                onClick={() => page(input.page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          </>
        )
      )}
      <Button
        variant="outline"
        disabled={list.isFetching || !input}
        onClick={() => void list.refetch()}
      >
        {t('refresh')}
      </Button>
    </>
  );
}
function PaymentFilters() {
  const t = useTranslations('paymentAdmin'),
    p = useSearchParams(),
    router = useRouter(),
    form = useForm({
      defaultValues: {
        q: p.get('q') ?? '',
        status: p.get('status') ?? '',
        provider: p.get('provider') ?? '',
        refundOnly: p.get('refundOnly') === 'true',
        from: p.get('from') ?? '',
        to: p.get('to') ?? '',
      },
    });
  return (
    <form
      className="admin-filters"
      onSubmit={form.handleSubmit((x) => {
        const d = paymentFilterFields.safeParse(x);
        if (!d.success) {
          form.setError('root', { message: 'invalid' });
          return;
        }
        form.clearErrors();
        const q = new URLSearchParams();
        for (const [key, value] of Object.entries(d.data))
          if (value !== '' && value !== false) q.set(key, String(value));
        router.push('/admin/payments' + (q.size ? '?' + q : ''));
      })}
    >
      <label className="commerce-field">
        {t('search')}
        <input {...form.register('q')} maxLength={100} type="search" />
      </label>
      <label className="commerce-field">
        {t('status')}
        <select {...form.register('status')}>
          <option value="">{t('all')}</option>
          {PAYMENT_STATUSES.map((x) => (
            <option value={x} key={x}>
              {t('states.' + x)}
            </option>
          ))}
        </select>
      </label>
      <label className="commerce-field">
        {t('provider')}
        <select {...form.register('provider')}>
          <option value="">{t('all')}</option>
          <option value="FAKE">{t('fake')}</option>
          <option value="LIQPAY">{t('liqpay')}</option>
        </select>
      </label>
      {(['from', 'to'] as const).map((x) => (
        <label className="commerce-field" key={x}>
          {t(x)}
          <input type="date" {...form.register(x)} />
        </label>
      ))}
      <label className="account-check">
        <input type="checkbox" {...form.register('refundOnly')} />
        {t('refundOnly')}
      </label>
      <p>{t('zone', { zone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>
      <div className="account-links">
        <Button type="submit">{t('apply')}</Button>
        <Link href="/admin/payments">{t('reset')}</Link>
      </div>
      {form.formState.errors.root && <p role="alert">{t('invalidFilters')}</p>}
    </form>
  );
}
