import type { CatalogSection } from '@tea/contracts';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { catalogApi } from '@/lib/api/catalog';
import { getCategories } from '@/lib/api/server-catalog';
import { buttonVariants } from '@/components/ui/button';
import { FilterForm } from './filter-form';
import { FilterDrawer } from './filter-drawer';
import { ProductCard } from './product-card';
import { StatePanel } from './state-panel';
import { catalogHref, parseCatalogQuery, type RawCatalogQuery } from './catalog-query';
export async function CatalogPage({
  raw,
  category,
  section,
}: {
  raw: RawCatalogQuery;
  category?: string;
  section?: Exclude<CatalogSection, 'ALL'>;
}) {
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
  query.section = section ?? query.section ?? current?.section ?? 'TEA';
  if (current && query.section !== 'ALL' && (current.section ?? 'TEA') !== query.section)
    notFound();
  const equipment = query.section === 'EQUIPMENT';
  const scopedCategories = categories.filter(
    (c) => query.section === 'ALL' || (c.section ?? 'TEA') === query.section,
  );
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
        <p className="eyebrow">
          {t(equipment ? 'equipmentEyebrow' : query.section === 'ALL' ? 'allEyebrow' : 'eyebrow')}
        </p>
        <h1>
          {current?.name ??
            t(equipment ? 'equipmentTitle' : query.section === 'ALL' ? 'allTitle' : 'title')}
        </h1>
        <p className="section-description">
          {current?.description ??
            t(
              equipment
                ? 'equipmentDescription'
                : query.section === 'ALL'
                  ? 'allDescription'
                  : 'description',
            )}
        </p>
      </div>
      <div className="catalog-layout">
        <aside className="filter-sidebar">
          <h2>{t(equipment ? 'equipmentFilterTitle' : 'filterTitle')}</h2>
          <FilterForm categories={scopedCategories} query={query} prefix="desktop" />
        </aside>
        <div className="catalog-content">
          <div className="catalog-toolbar">
            <div>
              <p>
                {result
                  ? t(query.section === 'TEA' ? 'resultCount' : 'productCount', {
                      count: result.total,
                    })
                  : common('loading')}
              </p>
              {query.q && <p className="search-summary">{t('searchFor', { query: query.q })}</p>}
            </div>
            <div className="mobile-filter-trigger">
              <FilterDrawer equipment={equipment}>
                <FilterForm categories={scopedCategories} query={query} prefix="mobile" />
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
              {result.items.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 3} />
              ))}
            </div>
          )}
          {result && result.totalPages > 1 && result.items.length > 0 && (
            <nav className="pagination" aria-label={t('pagination')}>
              {result.page > 1 ? (
                <a
                  className={buttonVariants({ variant: 'outline' })}
                  href={catalogHref(query, result.page - 1)}
                >
                  <span className="pagination-arrow" aria-hidden="true">
                    <ArrowLeft size={20} strokeWidth={2.6} />
                  </span>
                  {t('previous')}
                </a>
              ) : (
                <span />
              )}
              <span>{t('page', { page: result.page, total: result.totalPages })}</span>
              {result.page < result.totalPages ? (
                <a
                  className={buttonVariants({ variant: 'outline' })}
                  href={catalogHref(query, result.page + 1)}
                >
                  {t('next')}
                  <span className="pagination-arrow" aria-hidden="true">
                    <ArrowRight size={20} strokeWidth={2.6} />
                  </span>
                </a>
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
