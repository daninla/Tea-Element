'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { paymentAdminApi } from '@/lib/api/payment-admin';
import { Button } from '@/components/ui/button';
import { AdminTable } from './admin-table';
export function PaymentEvents({ paymentId }: { paymentId?: string }) {
  const t = useTranslations('paymentAdmin'),
    [page, setPage] = useState(1),
    [signature, setSignature] = useState('');
  const query = useQuery({
    queryKey: ['admin-payment-events', paymentId, page, signature],
    queryFn: () =>
      paymentAdminApi.events(page, paymentId, signature === '' ? undefined : signature === 'true'),
    retry: false,
  });
  return (
    <section>
      <h2>{t('events')}</h2>
      <label className="commerce-field">
        {t('signature')}
        <select
          value={signature}
          onChange={(e) => {
            setSignature(e.target.value);
            setPage(1);
          }}
        >
          <option value="">{t('all')}</option>
          <option value="true">{t('valid')}</option>
          <option value="false">{t('invalid')}</option>
        </select>
      </label>
      {query.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : query.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        query.data && (
          <>
            <p>{t('found', { count: query.data.total })}</p>
            <AdminTable
              caption={t('events')}
              headings={[t('created'), t('paymentId'), t('signature'), t('outcome')]}
            >
              {query.data.items.map((x) => (
                <tr key={x.id}>
                  <td>
                    {new Date(x.createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}
                  </td>
                  <td>
                    {x.paymentId ? (
                      <Link href={'/admin/payments/' + x.paymentId}>{x.paymentId}</Link>
                    ) : (
                      t('unassigned')
                    )}
                  </td>
                  <td>{t(x.signatureValid ? 'valid' : 'invalid')}</td>
                  <td>{x.outcome}</td>
                </tr>
              ))}
            </AdminTable>
            {!query.data.items.length && <p>{t('emptyEvents')}</p>}
            <nav className="account-links" aria-label={t('pagination')}>
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </Button>
              <span>
                {page} / {query.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= query.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          </>
        )
      )}
      <Button variant="outline" disabled={query.isFetching} onClick={() => void query.refetch()}>
        {t('refresh')}
      </Button>
    </section>
  );
}
