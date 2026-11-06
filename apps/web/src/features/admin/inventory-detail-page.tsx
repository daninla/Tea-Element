'use client';
import { AdminTable } from './admin-table';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { inventoryApi } from '@/lib/api/inventory';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { InventoryCommandForm } from './inventory-command-form';
export function InventoryDetailPage({ id, returnTo }: { id: string; returnTo: string }) {
  const t = useTranslations('inventory'),
    client = useQueryClient();
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const item = useQuery({
    queryKey: ['inventory-item', id],
    queryFn: () => inventoryApi.get(id),
    enabled: session.data?.role === 'ADMIN',
    retry: false,
  });
  if (item.isPending) return <p role="status">{t('loading')}</p>;
  if (item.isError)
    return (
      <>
        <Link href={returnTo}>{t('back')}</Link>
        <h1>
          {t(
            item.error instanceof OrdersApiError && item.error.status === 404
              ? 'notFound'
              : 'error',
          )}
        </h1>
        <Button onClick={() => void item.refetch()}>{t('refresh')}</Button>
      </>
    );
  const x = item.data;
  return (
    <>
      <Link href={returnTo} className="text-link">
        {t('back')}
      </Link>
      <h1>{x.name}</h1>
      <p>
        {x.category} · {t(x.unit === 'GRAM' ? 'grams' : 'pieces')}
        {!x.active && ' · ' + t('inactive')}
      </p>
      <dl className="admin-facts inventory-balances">
        {(['stock', 'reserved', 'available'] as const).map((field) => (
          <div key={field}>
            <dt>{t(field)}</dt>
            <dd>
              <strong>{x[field]}</strong> {t(x.unit === 'GRAM' ? 'grams' : 'pieces')}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        {t('threshold', {
          value: x.lowStockThreshold,
          unit: t(x.unit === 'GRAM' ? 'grams' : 'pieces'),
        })}
      </p>
      {x.available <= x.lowStockThreshold && <p className="notice">{t('low')}</p>}
      <Button
        variant="outline"
        onClick={() => {
          void item.refetch();
          void client.invalidateQueries({ queryKey: ['inventory-history', id] });
        }}
      >
        {t('refresh')}
      </Button>
      <div className="admin-detail-grid">
        <InventoryCommandForm item={x} actorId={session.data!.id} mode="PURCHASE" />
        <InventoryCommandForm item={x} actorId={session.data!.id} mode="ADJUST" />
      </div>
      <InventoryHistory key={id} id={id} />
    </>
  );
}
function InventoryHistory({ id }: { id: string }) {
  const t = useTranslations('inventory');
  const [kind, setKind] = useState<'MOVEMENTS' | 'PURCHASES'>('MOVEMENTS'),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['inventory-history', id, kind, page],
    queryFn: () => inventoryApi.history(id, kind, page),
    retry: false,
  });
  const data = query.data;
  const date = (x: string) =>
    new Intl.DateTimeFormat('uk-UA', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Europe/Kyiv',
    }).format(new Date(x));
  return (
    <section>
      <h2>{t('history')}</h2>
      <label className="commerce-field inventory-history-kind">
        {t('historyKind')}
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as 'MOVEMENTS' | 'PURCHASES');
            setPage(1);
          }}
        >
          <option value="MOVEMENTS">{t('movements')}</option>
          <option value="PURCHASES">{t('purchases')}</option>
        </select>
      </label>
      <p>{t('journalScope')}</p>
      {query.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : query.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        data && (
          <>
            {!data.items.length ? (
              <p>{t('emptyHistory')}</p>
            ) : data.kind === 'PURCHASES' ? (
              <AdminTable
                caption={t('purchases')}
                headings={[
                  t('purchaseDate'),
                  t('quantity'),
                  t('purchaseCost'),
                  t('supplier'),
                  t('note'),
                  t('actor'),
                  t('recorded'),
                ]}
              >
                {data.items.map((x) => (
                  <tr key={x.id}>
                    <td>{date(x.purchasedAt)}</td>
                    <td className="admin-numeric">
                      {x.quantity} {t(x.unit === 'GRAM' ? 'grams' : 'pieces')}
                    </td>
                    <td className="admin-numeric">{formatMoney(x.purchasePriceTotal)}</td>
                    <td>{x.supplier}</td>
                    <td className="admin-comment">{x.note}</td>
                    <td>{x.actorId}</td>
                    <td>
                      <time dateTime={x.createdAt}>{date(x.createdAt)}</time>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            ) : (
              <AdminTable
                caption={t('movements')}
                headings={[
                  t('recorded'),
                  t('operation'),
                  t('quantity'),
                  t('stockChange'),
                  t('reservedChange'),
                  t('note'),
                  t('actor'),
                  t('order'),
                ]}
              >
                {data.items.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <time dateTime={x.createdAt}>{date(x.createdAt)}</time>
                    </td>
                    <td>{t(`movementTypes.${x.type}`)}</td>
                    <td className="admin-numeric">
                      {x.quantity} {t(x.unit === 'PIECE' ? 'pieces' : 'grams')}
                    </td>
                    <td className="admin-numeric">{x.stockDelta}</td>
                    <td className="admin-numeric">{x.reservedDelta}</td>
                    <td className="admin-comment">{x.note}</td>
                    <td>{x.actorId ?? t('system')}</td>
                    <td>
                      {x.orderId && (
                        <Link className="text-link" href={'/admin/orders/' + x.orderId}>
                          {t('order')}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
            <nav className="account-links" aria-label={t('pagination')}>
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                {t('previous')}
              </Button>
              <span>
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
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
