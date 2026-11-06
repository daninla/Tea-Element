'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { DashboardDays } from '@tea/contracts';
import { adminApi } from '@/lib/api/admin';
import { inventoryApi } from '@/lib/api/inventory';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AdminTable } from './admin-table';
export function AdminDashboardPage() {
  const t = useTranslations('dashboard'),
    status = useTranslations('order.status');
  const [days, setDays] = useState<DashboardDays>(7);
  const report = useQuery({
    queryKey: ['admin-dashboard', days],
    queryFn: () => adminApi.dashboard(days),
    retry: false,
  });
  const low = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: () => inventoryApi.list({ page: 1, q: '', section: 'ALL', lowStock: true }),
    retry: false,
  });
  const recent = useQuery({
    queryKey: ['dashboard-recent-orders'],
    queryFn: () => adminApi.orders({ page: 1 }),
    retry: false,
  });
  const date = (x: string) => new Date(x).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const busy = report.isFetching || low.isFetching || recent.isFetching;
  return (
    <>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <nav className="account-links" aria-label={t('period')}>
        {([1, 7, 30] as const).map((n) => (
          <Button
            key={n}
            variant={days === n ? 'default' : 'outline'}
            aria-pressed={days === n}
            onClick={() => setDays(n)}
          >
            {t('days' + n)}
          </Button>
        ))}
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            void report.refetch();
            void low.refetch();
            void recent.refetch();
          }}
        >
          {t('refresh')}
        </Button>
      </nav>
      {report.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : report.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        report.data &&
        (() => {
          const x = report.data,
            max = Math.max(1, ...x.series.map((d) => d.onlineRevenue + d.codRevenue));
          return (
            <>
              <p>{t('range', { from: date(x.from), to: date(x.asOf) })}</p>
              <AdminTable caption={t('summary')} headings={[t('metric'), t('value')]}>
                {[
                  ['createdOrders', String(x.createdOrders)],
                  [
                    'unlinkedOrders',
                    `${x.unlinkedOrders} (${x.createdOrders ? ((x.unlinkedOrders / x.createdOrders) * 100).toFixed(1) : '0'}%)`,
                  ],
                  ['completedOrders', String(x.completedOrders)],
                  ['onlineRevenue', formatMoney(x.onlineRevenue)],
                  ['codRevenue', formatMoney(x.codRevenue)],
                  ['totalRevenue', formatMoney(x.onlineRevenue + x.codRevenue)],
                  ['averageOrder', formatMoney(x.averageOrder)],
                ].map(([key, value]) => (
                  <tr key={key}>
                    <th scope="row">{t(key!)}</th>
                    <td className="admin-numeric">{value}</td>
                  </tr>
                ))}
              </AdminTable>
              <details className="notice">
                <summary>{t('definitions')}</summary>
                <p>{t('recognition')}</p>
                <p>{t('guestsNote')}</p>
                <p>{t('snapshotNote')}</p>
              </details>
              <AdminTable
                caption={t('daily')}
                headings={[
                  t('day'),
                  t('createdOrders'),
                  t('completedOrders'),
                  t('onlineRevenue'),
                  t('codRevenue'),
                  t('totalRevenue'),
                ]}
              >
                {x.series.map((d) => (
                  <tr key={d.day}>
                    <th scope="row">{d.day}</th>
                    <td className="admin-numeric">{d.createdOrders}</td>
                    <td className="admin-numeric">{d.completedOrders}</td>
                    <td className="admin-numeric">{formatMoney(d.onlineRevenue)}</td>
                    <td className="admin-numeric">{formatMoney(d.codRevenue)}</td>
                    <td className="admin-numeric">
                      {formatMoney(d.onlineRevenue + d.codRevenue)}
                      <span
                        className="admin-revenue-bar"
                        aria-hidden="true"
                        style={{ width: `${((d.onlineRevenue + d.codRevenue) / max) * 100}%` }}
                      />
                    </td>
                  </tr>
                ))}
              </AdminTable>
              <h2>{t('top')}</h2>
              {!x.topProducts.length ? (
                <p>{t('noSales')}</p>
              ) : (
                <AdminTable
                  caption={t('top')}
                  headings={[t('product'), t('quantity'), t('revenue')]}
                >
                  {x.topProducts.map((p) => (
                    <tr key={p.productId + ':' + p.unit}>
                      <th scope="row">{p.name}</th>
                      <td className="admin-numeric">
                        {p.quantity} {t(p.unit === 'GRAM' ? 'grams' : 'pieces')}
                      </td>
                      <td className="admin-numeric">{formatMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </AdminTable>
              )}
            </>
          );
        })()
      )}
      <div className="admin-detail-grid">
        <section>
          <h2>{t('lowStock')}</h2>
          <p>{t('live')}</p>
          {low.isPending ? (
            <p role="status">{t('loading')}</p>
          ) : low.isError ? (
            <p role="alert">{t('inventoryError')}</p>
          ) : (
            low.data && (
              <>
                <p>{t('lowCount', { count: low.data.total })}</p>
                {!low.data.items.length ? (
                  <p>{t('noLowStock')}</p>
                ) : (
                  <AdminTable
                    caption={t('lowStock')}
                    headings={[t('product'), t('available'), t('threshold')]}
                  >
                    {low.data.items.map((p) => (
                      <tr key={p.productId}>
                        <th scope="row">
                          <Link href={'/admin/inventory/' + p.productId}>{p.name}</Link>
                          {!p.active && <small>{t('hidden')}</small>}
                        </th>
                        <td className="admin-numeric">
                          {p.available} {t(p.unit === 'GRAM' ? 'grams' : 'pieces')}
                        </td>
                        <td className="admin-numeric">{p.lowStockThreshold}</td>
                      </tr>
                    ))}
                  </AdminTable>
                )}
              </>
            )
          )}
          <Link className="text-link" href="/admin/inventory?lowStock=true">
            {t('allLowStock')}
          </Link>
        </section>
        <section>
          <h2>{t('recent')}</h2>
          <p>{t('live')}</p>
          {recent.isPending ? (
            <p role="status">{t('loading')}</p>
          ) : recent.isError ? (
            <p role="alert">{t('error')}</p>
          ) : (
            recent.data &&
            (!recent.data.items.length ? (
              <p>{t('noOrders')}</p>
            ) : (
              <AdminTable caption={t('recent')} headings={[t('order'), t('status'), t('total')]}>
                {recent.data.items.slice(0, 10).map((o) => (
                  <tr key={o.id}>
                    <th scope="row">
                      <Link href={'/admin/orders/' + o.id}>{o.number}</Link>
                      <small>{date(o.createdAt)}</small>
                    </th>
                    <td>{status(o.status)}</td>
                    <td className="admin-numeric">{formatMoney(o.total)}</td>
                  </tr>
                ))}
              </AdminTable>
            ))
          )}
          <Link className="text-link" href="/admin/orders">
            {t('allOrders')}
          </Link>
        </section>
      </div>
    </>
  );
}
