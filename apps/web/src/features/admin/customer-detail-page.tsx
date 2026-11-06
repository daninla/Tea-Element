'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { CustomerSelector } from '@tea/contracts';
import { customersApi } from '@/lib/api/customers';
import { OrdersApiError } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AdminTable } from './admin-table';
export function CustomerDetailPage({
  customer,
  returnTo,
}: {
  customer: CustomerSelector;
  returnTo: string;
}) {
  const t = useTranslations('customers'),
    status = useTranslations('order.status'),
    params = useSearchParams(),
    router = useRouter();
  const pathname = usePathname();
  const profile = pathname + (params.size ? '?' + params : '');
  const page = Number(params.get('page') ?? 1),
    valid =
      Number.isInteger(page) && page >= 1 && page <= 10000 && params.getAll('page').length <= 1;
  const account = useQuery({
    queryKey: ['admin-customer-account', customer.kind === 'ACCOUNT' ? customer.id : null],
    queryFn: () => customersApi.account(customer.kind === 'ACCOUNT' ? customer.id : ''),
    enabled: customer.kind === 'ACCOUNT',
    retry: false,
  });
  const history = useQuery({
    queryKey: ['admin-customer-history', customer, page],
    queryFn: () => customersApi.history(customer, page),
    enabled: valid && (customer.kind === 'GUEST' || !!account.data),
    retry: false,
  });
  const date = (x: string | null | undefined) =>
    x ? new Date(x).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : t('none');
  function move(n: number) {
    const p = new URLSearchParams(params);
    p.set('page', String(n));
    router.push('?' + p);
  }
  const contact = customer.kind === 'ACCOUNT' ? account.data : history.data?.summary.contact;
  return (
    <>
      <Link className="text-link" href={returnTo}>
        {t('back')}
      </Link>
      <h1>{t('detail')}</h1>
      <p>{t(customer.kind === 'ACCOUNT' ? 'accountHistoryNote' : 'guestNote')}</p>
      {customer.kind === 'ACCOUNT' && account.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : customer.kind === 'ACCOUNT' && account.isError ? (
        <p role="alert">
          {t(
            account.error instanceof OrdersApiError && account.error.status === 404
              ? 'notFound'
              : 'error',
          )}
        </p>
      ) : (
        contact && (
          <AdminTable caption={t('contact')} headings={[t('field'), t('value')]}>
            <tr>
              <th scope="row">{t('name')}</th>
              <td>
                {contact.firstName} {contact.lastName}
              </td>
            </tr>
            <tr>
              <th scope="row">{t('email')}</th>
              <td>{contact.email}</td>
            </tr>
            <tr>
              <th scope="row">{t('phone')}</th>
              <td>{contact.phone ?? t('none')}</td>
            </tr>
            {account.data && (
              <>
                <tr>
                  <th scope="row">{t('verified')}</th>
                  <td>
                    {account.data.emailVerifiedAt ? date(account.data.emailVerifiedAt) : t('no')}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{t('active')}</th>
                  <td>{t(account.data.isActive ? 'yes' : 'no')}</td>
                </tr>
                <tr>
                  <th scope="row">{t('created')}</th>
                  <td>{date(account.data.createdAt)}</td>
                </tr>
                <tr>
                  <th scope="row">{t('accountConsent')}</th>
                  <td>
                    {account.data.marketingConsentAt
                      ? date(account.data.marketingConsentAt)
                      : t('no')}
                  </td>
                </tr>
              </>
            )}
          </AdminTable>
        )
      )}
      {!valid ? (
        <p role="alert">{t('invalid')}</p>
      ) : history.isError ? (
        <p role="alert">
          {t(
            history.error instanceof OrdersApiError && history.error.status === 404
              ? 'notFound'
              : 'historyError',
          )}
        </p>
      ) : history.data ? (
        <>
          <AdminTable caption={t('summary')} headings={[t('field'), t('value')]}>
            {[
              ['orders', String(history.data.summary.orderCount)],
              ['completedCount', String(history.data.summary.completedCount)],
              ['completedTotal', formatMoney(history.data.summary.completedTotal)],
              ['firstOrder', date(history.data.summary.firstOrderAt)],
              ['lastOrder', date(history.data.summary.lastOrderAt)],
            ].map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{t(key!)}</th>
                <td className="admin-numeric">{value}</td>
              </tr>
            ))}
          </AdminTable>
          <h2>{t('orders')}</h2>
          <AdminTable
            caption={t('orders')}
            headings={[t('order'), t('created'), t('status'), t('payment'), t('total')]}
          >
            {history.data.orders.items.map((o) => (
              <tr key={o.id}>
                <th scope="row">
                  <Link href={'/admin/orders/' + o.id + '?returnTo=' + encodeURIComponent(profile)}>
                    {o.number}
                  </Link>
                </th>
                <td>{date(o.createdAt)}</td>
                <td>{status(o.status)}</td>
                <td>{t(o.paymentMethod === 'ONLINE_CARD' ? 'online' : 'cod')}</td>
                <td className="admin-numeric">{formatMoney(o.total)}</td>
              </tr>
            ))}
          </AdminTable>
          {!history.data.orders.items.length && <p>{t('emptyOrders')}</p>}
          <nav className="account-links" aria-label={t('pagination')}>
            <Button variant="outline" disabled={page <= 1} onClick={() => move(page - 1)}>
              {t('previous')}
            </Button>
            <span>
              {page} / {history.data.orders.totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page >= history.data.orders.totalPages}
              onClick={() => move(page + 1)}
            >
              {t('next')}
            </Button>
          </nav>
          <h2>{t('products')}</h2>
          <p>{t('productsNote')}</p>
          {!history.data.products.length ? (
            <p>{t('emptyProducts')}</p>
          ) : (
            <AdminTable
              caption={t('products')}
              headings={[t('product'), t('quantity'), t('revenue')]}
            >
              {history.data.products.map((x) => (
                <tr key={x.productId + ':' + x.unit}>
                  <th scope="row">{x.name}</th>
                  <td className="admin-numeric">
                    {x.quantity} {t(x.unit === 'GRAM' ? 'grams' : 'pieces')}
                  </td>
                  <td className="admin-numeric">{formatMoney(x.revenue)}</td>
                </tr>
              ))}
            </AdminTable>
          )}
        </>
      ) : (
        history.isPending &&
        (customer.kind === 'GUEST' || !!account.data) && <p role="status">{t('loading')}</p>
      )}
      <Button
        variant="outline"
        disabled={account.isFetching || history.isFetching}
        onClick={() => {
          if (customer.kind === 'ACCOUNT') void account.refetch();
          if (customer.kind === 'GUEST' || account.data) void history.refetch();
        }}
      >
        {t('refresh')}
      </Button>
    </>
  );
}
