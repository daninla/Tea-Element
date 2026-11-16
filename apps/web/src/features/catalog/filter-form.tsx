import { catalogHref } from './catalog-query';
import type { CatalogQuery, CategoryView } from '@tea/contracts';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
export async function FilterForm({
  categories,
  query,
  prefix,
}: {
  categories: CategoryView[];
  query: CatalogQuery;
  prefix: string;
}) {
  const t = await getTranslations('catalog');
  const common = await getTranslations('common');
  const action = query.section === 'EQUIPMENT' ? '/teaware' : '/catalog';
  return (
    <form key={catalogHref(query)} action={action} className="filter-form">
      {query.section === 'ALL' && <input type="hidden" name="section" value="ALL" />}
      <div className="filter-field">
        <label htmlFor={`${prefix}-search`}>{t('search')}</label>
        <Input id={`${prefix}-search`} name="q" defaultValue={query.q} maxLength={100} />
      </div>
      <div className="filter-field">
        <label htmlFor={`${prefix}-category`}>{t('category')}</label>
        <select
          className="select"
          id={`${prefix}-category`}
          name="category"
          defaultValue={query.category ?? ''}
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <fieldset>
        <legend>
          {t('minPrice')} / {t('maxPrice')}
        </legend>
        <div className="price-fields">
          <div>
            <label className="sr-only" htmlFor={`${prefix}-min`}>
              {t('minPrice')}
            </label>
            <Input
              id={`${prefix}-min`}
              name="minPrice"
              inputMode="decimal"
              placeholder="0"
              defaultValue={query.minPrice === undefined ? '' : query.minPrice / 100}
            />
          </div>
          <span aria-hidden="true">—</span>
          <div>
            <label className="sr-only" htmlFor={`${prefix}-max`}>
              {t('maxPrice')}
            </label>
            <Input
              id={`${prefix}-max`}
              name="maxPrice"
              inputMode="decimal"
              defaultValue={query.maxPrice === undefined ? '' : query.maxPrice / 100}
            />
          </div>
        </div>
      </fieldset>
      <div className="filter-field">
        <label htmlFor={`${prefix}-origin`}>{t('origin')}</label>
        <Input
          id={`${prefix}-origin`}
          name="origin"
          placeholder={t(
            query.section === 'EQUIPMENT' ? 'equipmentOriginPlaceholder' : 'originPlaceholder',
          )}
          defaultValue={query.origin}
          maxLength={150}
        />
      </div>
      <label className="check-label">
        <input
          type="checkbox"
          name="inStock"
          value="true"
          defaultChecked={query.inStock === true}
        />
        {t('onlyStock')}
      </label>
      <label className="check-label">
        <input type="checkbox" name="onSale" value="true" defaultChecked={query.onSale === true} />
        {t('onlySale')}
      </label>
      <div className="filter-field">
        <label htmlFor={`${prefix}-sort`}>{t('sort')}</label>
        <select
          className="select"
          id={`${prefix}-sort`}
          name="sort"
          defaultValue={query.sort ?? 'newest'}
        >
          <option value="newest">{t('newest')}</option>
          <option value="popular">{t('popular')}</option>
          <option value="price_asc">{t('priceAsc')}</option>
          <option value="price_desc">{t('priceDesc')}</option>
        </select>
      </div>
      <Button type="submit">{t(query.section === 'EQUIPMENT' ? 'applyProducts' : 'apply')}</Button>
      <a href={query.section === 'ALL' ? '/catalog?section=ALL' : action} className="filter-reset">
        {common('reset')}
      </a>
    </form>
  );
}
