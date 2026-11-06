'use client';
import { AdminTableScroll } from './admin-table';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ORDER_STATUSES } from '@tea/contracts';
import { adminApi } from '@/lib/api/admin';
import { ordersApi } from '@/lib/api/orders';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { orderFilterFields, parseOrderFilters } from './order-filters';
export function AdminOrdersPage() {
  const t = useTranslations('admin');
  const statusT = useTranslations('order.status');
  const params = useSearchParams();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const filters = parseOrderFilters(new URLSearchParams(params));
  const orders = useQuery({
    queryKey: ['admin-orders', session.data?.id, params.toString()],
    queryFn: () => adminApi.orders(filters!),
    enabled: ready && !!filters && session.data?.role === 'ADMIN',
    retry: false,
  });
  function page(value: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(value));
    router.push('/admin/orders?' + next);
  }
  return (
    <>
      <p className="eyebrow">{t('panel')}</p>
      <h1>{t('orders')}</h1>
      <p>{t('readOnly')}</p>
      <OrderFilters key={params.toString()} />
      {!filters ? (
        <p role="alert">{t('invalidFilters')}</p>
      ) : orders.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : orders.isError ? (
        <div role="alert">
          <p>{t('error')}</p>
          <Button onClick={() => void orders.refetch()}>{t('retry')}</Button>
        </div>
      ) : (
        orders.data && (
          <>
            <div className="admin-list-summary">
              <p role="status">{t('found', { count: orders.data.total })}</p>
              <Button
                variant="outline"
                disabled={orders.isFetching}
                onClick={() => void orders.refetch()}
              >
                {t('refresh')}
              </Button>
            </div>
            {!orders.data.items.length ? (
              <p>{t('empty')}</p>
            ) : (
              <AdminTableScroll label={t('orders')}>
                <table className="admin-table">
                  <caption>{t('orders')}</caption>
                  <thead>
                    <tr>
                      {['number', 'date', 'customer', 'type', 'status', 'payment', 'total'].map(
                        (key) => (
                          <th key={key} scope="col">
                            {t(key)}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data.items.map((order) => (
                      <tr key={order.id}>
                        <th scope="row">
                          <Link
                            href={`/admin/orders/${order.id}?returnTo=${encodeURIComponent('/admin/orders' + (params.size ? '?' + params.toString() : ''))}`}
                            className="text-link"
                          >
                            {order.number}
                          </Link>
                        </th>
                        <td>
                          <time dateTime={order.createdAt}>
                            {new Intl.DateTimeFormat('uk-UA', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                              timeZone: 'Europe/Kyiv',
                            }).format(new Date(order.createdAt))}
                          </time>
                        </td>
                        <td>
                          {order.firstName} {order.lastName}
                          <small>{order.email}</small>
                        </td>
                        <td>{t(order.userId ? 'accountType' : 'guestType')}</td>
                        <td>{statusT(order.status)}</td>
                        <td>
                          {t(order.paymentMethod === 'ONLINE_CARD' ? 'online' : 'cod')}
                          <small>{t(`paymentStatus.${order.paymentStatus ?? 'UNPAID'}`)}</small>
                        </td>
                        <td className="admin-numeric">{formatMoney(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableScroll>
            )}
            <nav aria-label={t('pagination')} className="account-links">
              <Button
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => page(filters.page - 1)}
              >
                {t('previous')}
              </Button>
              <span>
                {filters.page} / {orders.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={filters.page >= orders.data.totalPages}
                onClick={() => page(filters.page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          </>
        )
      )}
    </>
  );
}
function OrderFilters() {
  const t = useTranslations('admin');
  const statusT = useTranslations('order.status');
  const params = useSearchParams();
  const router = useRouter();
  const [invalid, setInvalid] = useState(false);
  const form = useForm({
    defaultValues: Object.fromEntries(
      ['q', 'status', 'paymentMethod', 'customerType', 'from', 'to'].map((key) => [
        key,
        params.get(key) ?? '',
      ]),
    ),
  });
  return (
    <form
      className="admin-filters"
      noValidate
      onSubmit={form.handleSubmit((raw) => {
        const parsed = orderFilterFields.safeParse(raw);
        setInvalid(!parsed.success);
        if (!parsed.success) return;
        const next = new URLSearchParams();
        for (const [key, value] of Object.entries(parsed.data)) if (value) next.set(key, value);
        router.push('/admin/orders' + (next.size ? '?' + next : ''));
      })}
    >
      <label className="commerce-field">
        {t('search')}
        <input
          {...form.register('q')}
          maxLength={100}
          type="search"
          placeholder={t('searchHint')}
        />
      </label>
      <label className="commerce-field">
        {t('status')}
        <select {...form.register('status')}>
          <option value="">{t('all')}</option>
          {ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {statusT(status)}
            </option>
          ))}
        </select>
      </label>
      <label className="commerce-field">
        {t('payment')}
        <select {...form.register('paymentMethod')}>
          <option value="">{t('all')}</option>
          <option value="CASH_ON_DELIVERY">{t('cod')}</option>
          <option value="ONLINE_CARD">{t('online')}</option>
        </select>
      </label>
      <label className="commerce-field">
        {t('type')}
        <select {...form.register('customerType')}>
          <option value="">{t('all')}</option>
          <option value="GUEST">{t('guestType')}</option>
          <option value="ACCOUNT">{t('accountType')}</option>
        </select>
      </label>
      <label className="commerce-field">
        {t('from')}
        <input type="date" {...form.register('from')} />
      </label>
      <label className="commerce-field">
        {t('to')}
        <input type="date" {...form.register('to')} />
      </label>
      <div className="account-links">
        <Button type="submit">{t('apply')}</Button>
        <Link href="/admin/orders" className="text-link">
          {t('reset')}
        </Link>
      </div>
      {invalid && <p role="alert">{t('invalidFilters')}</p>}
    </form>
  );
}
