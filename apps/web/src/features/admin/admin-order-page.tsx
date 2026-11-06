'use client';
import { AdminTable } from './admin-table';
import { AdminStockMovements } from './admin-stock-movements';
import { AdminOrderActions } from './admin-order-actions';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { adminApi } from '@/lib/api/admin';
import { ordersApi, OrdersApiError } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
export function AdminOrderPage({
  id,
  returnTo = '/admin/orders',
}: {
  id: string;
  returnTo?: string;
}) {
  const t = useTranslations('admin');
  const statusT = useTranslations('order.status');
  const unitT = useTranslations('admin');
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const order = useQuery({
    queryKey: ['admin-order', session.data?.id, id],
    queryFn: () => adminApi.order(id),
    enabled: session.data?.role === 'ADMIN',
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.status === 'SHIPPED' && !query.state.data.stockDeductedAt ? 2000 : false,
  });
  const date = (value: string) =>
    new Intl.DateTimeFormat('uk-UA', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Kyiv',
    }).format(new Date(value));
  if (order.isPending) return <p role="status">{t('loading')}</p>;
  if (order.isError)
    return (
      <>
        <Link href={returnTo}>{t('back')}</Link>
        <h1>
          {t(
            order.error instanceof OrdersApiError && order.error.status === 404
              ? 'notFound'
              : 'error',
          )}
        </h1>
        <Button onClick={() => void order.refetch()}>{t('retry')}</Button>
      </>
    );
  const x = order.data;
  return (
    <>
      <Link href={returnTo} className="text-link">
        {t('back')}
      </Link>
      <h1 className="admin-order-number">{x.number}</h1>
      <p>
        {statusT(x.status)} · <time dateTime={x.createdAt}>{date(x.createdAt)}</time>
      </p>
      <p>{t('readOnly')}</p>
      <Button variant="outline" disabled={order.isFetching} onClick={() => void order.refetch()}>
        {t('refresh')}
      </Button>
      <AdminOrderActions order={x} />
      <AdminStockMovements
        key={x.id}
        id={x.id}
        stockDeductedAt={x.stockDeductedAt}
        pending={x.status === 'SHIPPED' && !x.stockDeductedAt}
      />
      <div className="admin-detail-grid">
        <section className="notice">
          <h2>{t('customer')}</h2>
          <dl className="admin-facts">
            <dt>{t('name')}</dt>
            <dd>
              {x.firstName} {x.lastName}
            </dd>
            <dt>{t('email')}</dt>
            <dd>{x.email}</dd>
            <dt>{t('phone')}</dt>
            <dd>{x.phone}</dd>
            <dt>{t('type')}</dt>
            <dd>{t(x.userId ? 'accountType' : 'guestType')}</dd>
          </dl>
          {x.comment && (
            <>
              <h3>{t('comment')}</h3>
              <p className="admin-comment">{x.comment}</p>
            </>
          )}
        </section>
        <section className="notice">
          <h2>{t('delivery')}</h2>
          <p>{t(`deliveryMethods.${x.delivery.method}`)}</p>
          <p>{x.delivery.city}</p>
          <p>{x.delivery.address}</p>
          <h2>{t('payment')}</h2>
          <p>
            {t(x.paymentMethod === 'ONLINE_CARD' ? 'online' : 'cod')} ·{' '}
            {t(`paymentStatus.${x.paymentStatus ?? 'UNPAID'}`)}
          </p>
        </section>
      </div>
      <section>
        <h2>{t('items')}</h2>
        <AdminTable
          caption={t('items')}
          headings={[t('product'), t('portionLabel'), t('quantity'), t('unitPrice'), t('total')]}
        >
          {x.items.map((item) => (
            <tr key={item.variantId}>
              <th scope="row">{item.name}</th>
              <td>
                {item.weightGrams === null
                  ? unitT('piece')
                  : unitT('portion', { weight: item.weightGrams })}
              </td>
              <td className="admin-numeric">{item.quantity}</td>
              <td className="admin-numeric">{formatMoney(item.unitPrice)}</td>
              <td className="admin-numeric">{formatMoney(item.unitPrice * item.quantity)}</td>
            </tr>
          ))}
        </AdminTable>
        <dl className="admin-facts admin-totals">
          <dt>{t('subtotal')}</dt>
          <dd>{formatMoney(x.subtotal)}</dd>
          <dt>{t('discount')}</dt>
          <dd>{formatMoney(x.discount)}</dd>
          <dt>{t('total')}</dt>
          <dd>
            <strong>{formatMoney(x.total)}</strong>
          </dd>
        </dl>
      </section>
      <section>
        <h2>{t('audit')}</h2>
        {x.actions.length ? (
          <AdminTable
            caption={t('audit')}
            headings={[t('recordedAt'), t('status'), t('reason'), t('actor')]}
          >
            {x.actions.map((action, i) => (
              <tr key={i}>
                <td>
                  <time dateTime={action.at}>{date(action.at)}</time>
                </td>
                <td>
                  {statusT(action.fromStatus)} → {statusT(action.status)}
                </td>
                <td className="admin-comment">{action.reason}</td>
                <td>{action.actorId}</td>
              </tr>
            ))}
          </AdminTable>
        ) : (
          <p>{t('noActions')}</p>
        )}
      </section>
      <section>
        <h2>{t('history')}</h2>
        <AdminTable caption={t('history')} headings={[t('recordedAt'), t('status')]}>
          {x.history.map((step, i) => (
            <tr key={step.at + '-' + i}>
              <td>
                <time dateTime={step.at}>{date(step.at)}</time>
              </td>
              <td>{statusT(step.status)}</td>
            </tr>
          ))}
        </AdminTable>
      </section>
    </>
  );
}
