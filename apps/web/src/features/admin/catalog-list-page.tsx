'use client';
import { AdminTableScroll } from './admin-table';
import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { catalogAdminApi } from '@/lib/api/catalog-admin';
import { Button } from '@/components/ui/button';
import { parseCatalogFilters } from './catalog-schema';
export function CatalogListPage() {
  const t = useTranslations('catalogAdmin'),
    p = useSearchParams(),
    router = useRouter();
  const filters = parseCatalogFilters(new URLSearchParams(p));
  const query = new URLSearchParams();
  if (filters) {
    query.set('page', String(filters.page));
    if (filters.q) query.set('q', filters.q);
    if (filters.section) query.set('section', filters.section);
    if (filters.active) query.set('active', filters.active);
  }
  const list = useQuery({
    queryKey: ['admin-products', query.toString()],
    queryFn: () => catalogAdminApi.products(query.toString()),
    enabled: !!filters,
    retry: false,
  });
  const form = useForm({
    defaultValues: {
      q: p.get('q') ?? '',
      section: p.get('section') ?? '',
      active: p.get('active') ?? '',
    },
  });
  const { reset } = form;
  useEffect(() => {
    reset({ q: p.get('q') ?? '', section: p.get('section') ?? '', active: p.get('active') ?? '' });
  }, [p, reset]);
  function page(n: number) {
    const q = new URLSearchParams(p);
    q.set('page', String(n));
    router.push('/admin/products?' + q);
  }
  return (
    <>
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('products')}</h1>
      <p>{t('intro')}</p>
      <Link className="button button-primary" href="/admin/products/new">
        {t('newProduct')}
      </Link>
      <form
        className="admin-filters"
        onSubmit={form.handleSubmit((x) => {
          const q = new URLSearchParams();
          Object.entries(x).forEach(([k, v]) => {
            if (v) q.set(k, v);
          });
          router.push('/admin/products?' + q);
        })}
      >
        <label className="commerce-field">
          {t('search')}
          <input type="search" maxLength={100} {...form.register('q')} />
        </label>
        <label className="commerce-field">
          {t('section')}
          <select {...form.register('section')}>
            <option value="">{t('all')}</option>
            <option value="TEA">{t('TEA')}</option>
            <option value="EQUIPMENT">{t('EQUIPMENT')}</option>
          </select>
        </label>
        <label className="commerce-field">
          {t('visibility')}
          <select {...form.register('active')}>
            <option value="">{t('all')}</option>
            <option value="true">{t('active')}</option>
            <option value="false">{t('hidden')}</option>
          </select>
        </label>
        <div className="account-links">
          <Button type="submit">{t('search')}</Button>
          <Link href="/admin/products">{t('reset')}</Link>
        </div>
      </form>
      {!filters ? (
        <p role="alert">{t('invalid')}</p>
      ) : list.isPending ? (
        <p role="status">{t('loading')}</p>
      ) : list.isError ? (
        <p role="alert">{t('error')}</p>
      ) : (
        list.data && (
          <>
            <p role="status">{t('found', { count: list.data.total })}</p>
            <AdminTableScroll label={t('products')}>
              <table className="admin-table">
                <caption>{t('products')}</caption>
                <thead>
                  <tr>
                    {['name', 'category', 'visibility', 'price'].map((x) => (
                      <th scope="col" key={x}>
                        {t(x)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((x) => (
                    <tr key={x.id}>
                      <th scope="row">
                        <Link className="text-link" href={'/admin/products/' + x.id}>
                          {x.name}
                        </Link>
                      </th>
                      <td>{x.category.name}</td>
                      <td>{t(x.isActive ? 'active' : 'hidden')}</td>
                      <td className="admin-numeric">
                        {(Math.min(...x.variants.map((v) => v.price)) / 100).toLocaleString(
                          'uk-UA',
                          { style: 'currency', currency: 'UAH' },
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </AdminTableScroll>
            {!list.data.items.length && <p>{t('empty')}</p>}
            <nav className="account-links" aria-label={t('pagination')}>
              <Button
                variant="outline"
                disabled={filters.page <= 1}
                onClick={() => page(filters.page - 1)}
              >
                {t('previous')}
              </Button>
              <span>
                {filters.page} / {list.data.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={filters.page >= list.data.totalPages}
                onClick={() => page(filters.page + 1)}
              >
                {t('next')}
              </Button>
            </nav>
          </>
        )
      )}
      <Button variant="outline" onClick={() => void list.refetch()} disabled={list.isFetching}>
        {t('refresh')}
      </Button>
    </>
  );
}
