'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReconciliationReceipt } from '@tea/contracts';
import { OrdersApiError } from '@/lib/api/orders';
import { paymentAdminApi } from '@/lib/api/payment-admin';
import { Button } from '@/components/ui/button';
import { AdminTable } from './admin-table';
import { PaymentEvents } from './payment-events';
import { PaymentReconcileForm } from './payment-reconcile-form';
import { paymentMoney } from './payment-admin-filters';
export function AdminPaymentDetailPage({ id, returnTo }: { id: string; returnTo: string }) {
  const t = useTranslations('paymentAdmin'),
    client = useQueryClient(),
    [receipt, setReceipt] = useState<ReconciliationReceipt>();
  const detail = useQuery({
    queryKey: ['admin-payment', id],
    queryFn: () => paymentAdminApi.detail(id),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const date = (x: string | null) =>
    x ? new Date(x).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }) : t('none');
  function refresh() {
    void detail.refetch();
    void client.invalidateQueries({ queryKey: ['admin-payment-events', id] });
    void client.invalidateQueries({ queryKey: ['admin-payment-commands', id] });
  }
  return (
    <>
      <Link className="text-link" href={returnTo}>
        {t('back')}
      </Link>
      <h1>{t('detail')}</h1>
      {detail.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : detail.isError ? (
        <p role="alert">
          {t(
            detail.error instanceof OrdersApiError && detail.error.status === 404
              ? 'notFound'
              : 'error',
          )}
        </p>
      ) : (
        detail.data && (
          <>
            <AdminTable caption={t('detail')} headings={[t('field'), t('value')]}>
              {[
                ['paymentId', detail.data.payment.id],
                ['order', detail.data.payment.orderNumber],
                ['status', t('states.' + detail.data.payment.status)],
                ['amount', paymentMoney(detail.data.payment.amount, detail.data.payment.currency)],
                ['provider', detail.data.payment.provider],
                ['providerId', detail.data.payment.providerPaymentId ?? t('none')],
                ['created', date(detail.data.payment.createdAt)],
                ['updated', date(detail.data.payment.updatedAt)],
                ['paid', date(detail.data.payment.paidAt)],
                ['expires', date(detail.data.payment.expiresAt)],
                ['nextCheck', date(detail.data.payment.nextReconcileAt)],
                ['cancelRequested', t(detail.data.payment.cancelRequested ? 'yes' : 'no')],
              ].map(([key, value]) => (
                <tr key={key}>
                  <th scope="row">{t(key!)}</th>
                  <td>{value}</td>
                </tr>
              ))}
            </AdminTable>
            <div className="account-links">
              <Link className="text-link" href={'/admin/orders/' + detail.data.payment.orderId}>
                {t('openOrder')}
              </Link>
              <Button variant="outline" onClick={refresh} disabled={detail.isFetching}>
                {t('refresh')}
              </Button>
            </div>
            <section>
              <h2>{t('refund')}</h2>
              {detail.data.refund ? (
                <>
                  <AdminTable
                    caption={t('refund')}
                    headings={[t('status'), t('amount'), t('created'), t('updated')]}
                  >
                    <tr>
                      <td>{t('refundStates.' + detail.data.refund.status)}</td>
                      <td className="admin-numeric">
                        {paymentMoney(detail.data.refund.amount, detail.data.payment.currency)}
                      </td>
                      <td>{date(detail.data.refund.createdAt)}</td>
                      <td>{date(detail.data.refund.updatedAt)}</td>
                    </tr>
                  </AdminTable>
                  {detail.data.refund.status === 'REVIEW_REQUIRED' && (
                    <p className="notice">{t('refundReview')}</p>
                  )}
                </>
              ) : (
                <p>{t('noRefund')}</p>
              )}
            </section>
            {['CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED'].includes(
              detail.data.payment.status,
            ) ? (
              <PaymentReconcileForm
                key={detail.data.payment.status}
                payment={detail.data.payment}
                onQueued={(x) => {
                  setReceipt(x);
                  refresh();
                }}
              />
            ) : (
              <p>{t('terminal')}</p>
            )}
            {receipt && <p role="status">{t('queued', { at: date(receipt.requestedAt) })}</p>}
            <PaymentCommands
              id={id}
              terminal={['REFUNDED', 'PARTIALLY_REFUNDED'].includes(detail.data.payment.status)}
            />
            <PaymentEvents paymentId={id} />
          </>
        )
      )}
    </>
  );
}
function PaymentCommands({ id, terminal }: { id: string; terminal: boolean }) {
  const t = useTranslations('paymentAdmin'),
    [page, setPage] = useState(1),
    q = useQuery({
      queryKey: ['admin-payment-commands', id, page],
      queryFn: () => paymentAdminApi.commands(id, page),
      retry: false,
    });
  return (
    <section>
      <h2>{t('commands')}</h2>
      {q.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : q.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        q.data && (
          <>
            <AdminTable
              caption={t('commands')}
              headings={[t('created'), t('attempted'), t('actor'), t('reason')]}
            >
              {q.data.items.map((x) => (
                <tr key={x.id}>
                  <td>
                    {new Date(x.createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}
                  </td>
                  <td>
                    {x.attemptedAt
                      ? new Date(x.attemptedAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })
                      : t(terminal ? 'terminalAttempt' : 'awaitingAttempt')}
                  </td>
                  <td>{x.actorId}</td>
                  <td className="admin-comment">{x.reason}</td>
                </tr>
              ))}
            </AdminTable>
            {!q.data.items.length && <p>{t('emptyCommands')}</p>}
            <div className="account-links">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t('previous')}
              </Button>
              <span>
                {page} / {q.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= q.data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                {t('next')}
              </Button>
            </div>
          </>
        )
      )}
      <Button variant="outline" disabled={q.isFetching} onClick={() => void q.refetch()}>
        {t('refresh')}
      </Button>
    </section>
  );
}
