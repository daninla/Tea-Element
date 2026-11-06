'use client';
import { AdminTableScroll } from './admin-table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { inventoryApi } from '@/lib/api/inventory';
import { ordersApi } from '@/lib/api/orders';
import { Button } from '@/components/ui/button';
import { inventoryFilters, parseInventoryFilters } from './inventory-schema';
export function InventoryListPage() {
  const t = useTranslations('inventory');
  const params = useSearchParams();
  const router = useRouter();
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  const input = parseInventoryFilters(new URLSearchParams(params));
  const list = useQuery({
    queryKey: ['inventory-list', session.data?.id, params.toString()],
    queryFn: () => inventoryApi.list(input!),
    enabled: !!input && session.data?.role === 'ADMIN',
    retry: false,
  });
  function page(value: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(value));
    router.push('/admin/inventory?' + next);
  }
  return (
    <>
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      <InventoryFilters key={params.toString()} />
      {!input ? (
        <p role="alert">{t('invalid')}</p>
      ) : list.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : list.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        list.data && (
          <>
            <p role="status">{t('found', { count: list.data.total })}</p>
            {!list.data.items.length ? (
              <p>{t('empty')}</p>
            ) : (
              <AdminTableScroll label={t('title')}>
                <table className="admin-table">
                  <caption>{t('title')}</caption>
                  <thead>
                    <tr>
                      {['product', 'stock', 'reserved', 'available'].map((x) => (
                        <th scope="col" key={x}>
                          {t(x)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.items.map((x) => (
                      <tr key={x.productId}>
                        <th scope="row">
                          <Link
                            className="text-link"
                            href={`/admin/inventory/${x.productId}?returnTo=${encodeURIComponent('/admin/inventory' + (params.size ? '?' + params : ''))}`}
                          >
                            {x.name}
                          </Link>
                          <small>
                            {x.category} · {t(x.unit === 'GRAM' ? 'grams' : 'pieces')}
                            {!x.active && ' · ' + t('inactive')}
                          </small>
                        </th>
                        <td className="admin-numeric">{x.stock}</td>
                        <td className="admin-numeric">{x.reserved}</td>
                        <td className="admin-numeric">
                          {x.available}
                          {x.available <= x.lowStockThreshold && <small>{t('low')}</small>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </AdminTableScroll>
            )}
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
      <Button variant="outline" disabled={list.isFetching} onClick={() => void list.refetch()}>
        {t('refresh')}
      </Button>
    </>
  );
}
function InventoryFilters() {
  const t = useTranslations('inventory');
  const params = useSearchParams(),
    router = useRouter();
  const form = useForm({
    defaultValues: {
      q: params.get('q') ?? '',
      section: params.get('section') ?? 'ALL',
      lowStock: params.get('lowStock') === 'true',
    },
  });
  return (
    <form
      className="admin-filters"
      onSubmit={form.handleSubmit((raw) => {
        const parsed = inventoryFilters.safeParse({ ...raw, page: 1 });
        if (!parsed.success) return;
        const next = new URLSearchParams();
        if (parsed.data.q) next.set('q', parsed.data.q);
        if (parsed.data.section !== 'ALL') next.set('section', parsed.data.section);
        if (parsed.data.lowStock) next.set('lowStock', 'true');
        router.push('/admin/inventory' + (next.size ? '?' + next : ''));
      })}
    >
      <label className="commerce-field">
        {t('search')}
        <input {...form.register('q')} maxLength={100} type="search" />
      </label>
      <label className="commerce-field">
        {t('section')}
        <select {...form.register('section')}>
          <option value="ALL">{t('all')}</option>
          <option value="TEA">{t('tea')}</option>
          <option value="EQUIPMENT">{t('equipment')}</option>
        </select>
      </label>
      <label className="account-check">
        <input type="checkbox" {...form.register('lowStock')} />
        {t('lowOnly')}
      </label>
      <div className="account-links">
        <Button type="submit">{t('apply')}</Button>
        <Link href="/admin/inventory">{t('reset')}</Link>
      </div>
    </form>
  );
}
