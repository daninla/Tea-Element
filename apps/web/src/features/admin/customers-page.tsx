'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { CustomerAccountPage, GuestCustomerPage } from '@tea/contracts';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { customersApi } from '@/lib/api/customers';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AdminTable } from './admin-table';
import { parseCustomerFilters } from './customer-filters';
export function CustomersPage() {
  const t = useTranslations('customers'),
    params = useSearchParams(),
    router = useRouter();
  const filters = parseCustomerFilters(new URLSearchParams(params));
  const data = useQuery<CustomerAccountPage | GuestCustomerPage>({
    queryKey: ['admin-customers', params.toString()],
    queryFn: () =>
      filters!.kind === 'ACCOUNT' ? customersApi.accounts(filters!) : customersApi.guests(filters!),
    enabled: !!filters,
    retry: false,
  });
  function navigate(kind: string, page = 1, q = filters?.q ?? '') {
    const p = new URLSearchParams({ kind, page: String(page) });
    if (q) p.set('q', q);
    router.push('/admin/customers?' + p);
  }
  const back = '/admin/customers' + (params.size ? '?' + params : '');
  return (
    <>
      <h1>{t('title')}</h1>
      <nav className="account-links" aria-label={t('groups')}>
        {(['ACCOUNT', 'GUEST'] as const).map((x) => (
          <Button
            key={x}
            variant={filters?.kind === x ? 'default' : 'outline'}
            aria-pressed={filters?.kind === x}
            onClick={() => navigate(x)}
          >
            {t(x)}
          </Button>
        ))}
      </nav>
      <p>{t(filters?.kind === 'GUEST' ? 'guestNote' : 'accountNote')}</p>
      <CustomerSearch
        key={params.toString()}
        q={filters?.q ?? ''}
        apply={(q) => navigate(filters?.kind ?? 'ACCOUNT', 1, q)}
        reset={() => navigate(filters?.kind ?? 'ACCOUNT', 1, '')}
      />
      {!filters ? (
        <p role="alert">{t('invalid')}</p>
      ) : data.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : data.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        data.data && (
          <>
            <p role="status">{t('found', { count: data.data.total })}</p>
            <AdminTable
              caption={t(filters.kind)}
              headings={
                filters.kind === 'ACCOUNT'
                  ? [t('name'), t('email'), t('phone'), t('verified'), t('active'), t('created')]
                  : [
                      t('name'),
                      t('email'),
                      t('phone'),
                      t('orders'),
                      t('completedTotal'),
                      t('lastOrder'),
                    ]
              }
            >
              {data.data.items.map((x) => {
                const account = 'id' in x;
                const href = account
                  ? '/admin/customers/accounts/' + x.id
                  : '/admin/customers/guest?email=' + encodeURIComponent(x.email);
                return (
                  <tr key={account ? x.id : x.email}>
                    <th scope="row">
                      <Link
                        href={href + (account ? '?' : '&') + 'returnTo=' + encodeURIComponent(back)}
                      >
                        {x.firstName} {x.lastName}
                      </Link>
                    </th>
                    <td>{x.email}</td>
                    <td>{x.phone ?? t('none')}</td>
                    {account ? (
                      <>
                        <td>{t(x.emailVerifiedAt ? 'yes' : 'no')}</td>
                        <td>{t(x.isActive ? 'yes' : 'no')}</td>
                        <td>
                          {new Date(x.createdAt).toLocaleString('uk-UA', {
                            timeZone: 'Europe/Kyiv',
                          })}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="admin-numeric">{x.orderCount}</td>
                        <td className="admin-numeric">{formatMoney(x.completedTotal)}</td>
                        <td>
                          {new Date(x.lastOrderAt).toLocaleString('uk-UA', {
                            timeZone: 'Europe/Kyiv',
                          })}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </AdminTable>
            {!data.data.items.length && <p>{t('empty')}</p>}
            <nav className="account-links" aria-label={t('pagination')}>
              <Button
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => navigate(filters.kind, filters.page - 1)}
              >
                {t('previous')}
              </Button>
              <span>
                {filters.page} / {data.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={filters.page >= data.data.totalPages}
                onClick={() => navigate(filters.kind, filters.page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          </>
        )
      )}
      <Button
        variant="outline"
        disabled={data.isFetching || !filters}
        onClick={() => void data.refetch()}
      >
        {t('refresh')}
      </Button>
    </>
  );
}
function CustomerSearch({
  q,
  apply,
  reset,
}: {
  q: string;
  apply: (q: string) => void;
  reset: () => void;
}) {
  const t = useTranslations('customers'),
    form = useForm({ defaultValues: { q } });
  return (
    <form className="admin-filters" onSubmit={form.handleSubmit((x) => apply(x.q.trim()))}>
      <label className="commerce-field">
        {t('search')}
        <input type="search" {...form.register('q')} maxLength={100} />
      </label>
      <div className="account-links">
        <Button type="submit">{t('search')}</Button>
        <Button type="button" variant="outline" onClick={reset}>
          {t('reset')}
        </Button>
      </div>
    </form>
  );
}
