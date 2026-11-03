import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { catalogApi } from '@/lib/api/catalog';
import { getCategories } from '@/lib/api/server-catalog';
import { Button } from '@/components/ui/button';
import { FilterForm } from './filter-form';
import { FilterDrawer } from './filter-drawer';
import { ProductCard } from './product-card';
import { StatePanel } from './state-panel';
import { catalogHref, parseCatalogQuery, type RawCatalogQuery } from './catalog-query';
export async function CatalogPage({ raw, category }: { raw: RawCatalogQuery; category?: string }) {
  const t = await getTranslations('catalog');
  const common = await getTranslations('common');
  const parsed = parseCatalogQuery(raw, category);
  if (!parsed.success)
    return (
      <section className="container section">
        <StatePanel kind="invalid" />
      </section>
    );
  const query = { ...parsed.data, pageSize: parsed.data.pageSize ?? 9 };
  const categories = await getCategories().catch(() => null);
  if (!categories)
    return (
      <section className="container section">
        <StatePanel />
      </section>
    );
  const current = categories.find((c) => c.slug === query.category);
  if (query.category && !current) notFound();
  const result = await catalogApi.products(query).catch(() => null);
  return (
    <section className="container catalog-section">
      <nav className="breadcrumbs" aria-label={common('catalog')}>
        <Link href="/">{common('home')}</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span>{common('catalog')}</span>
        {current && (
          <>
            <ChevronRight size={12} aria-hidden="true" />
            <span>{current.name}</span>
          </>
        )}
      </nav>
      <div className="catalog-heading">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{current?.name ?? t('title')}</h1>
        <p className="section-description">{current?.description ?? t('description')}</p>
      </div>
      <div className="catalog-layout">
        <aside className="filter-sidebar">
          <h2>{t('filterTitle')}</h2>
          <FilterForm categories={categories} query={query} prefix="desktop" />
        </aside>
        <div className="catalog-content">
          <div className="catalog-toolbar">
            <div>
              <p>{result ? t('resultCount', { count: result.total }) : common('loading')}</p>
              {query.q && <p className="search-summary">{t('searchFor', { query: query.q })}</p>}
            </div>
            <div className="mobile-filter-trigger">
              <FilterDrawer>
                <FilterForm categories={categories} query={query} prefix="mobile" />
              </FilterDrawer>
            </div>
            <span className="catalog-sort-label">
              {t(
                query.sort === 'price_asc'
                  ? 'priceAsc'
                  : query.sort === 'price_desc'
                    ? 'priceDesc'
                    : query.sort === 'popular'
                      ? 'popular'
                      : 'newest',
              )}
            </span>
          </div>
          {!result ? (
            <StatePanel />
          ) : !result.items.length ? (
            <StatePanel kind="empty" />
          ) : (
            <div className="product-grid catalog-grid">
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          {result && result.totalPages > 1 && result.items.length > 0 && (
            <nav className="pagination" aria-label={t('pagination')}>
              {result.page > 1 ? (
                <Button variant="outline" asChild>
                  <Link href={catalogHref(query, result.page - 1)}>
                    <ArrowLeft size={15} aria-hidden="true" />
                    {t('previous')}
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span>{t('page', { page: result.page, total: result.totalPages })}</span>
              {result.page < result.totalPages ? (
                <Button variant="outline" asChild>
                  <Link href={catalogHref(query, result.page + 1)}>
                    {t('next')}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </div>
    </section>
  );
}
