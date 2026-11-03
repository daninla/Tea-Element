'use client';
import { useEffect, useId, useState } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { searchHref } from './search-query';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { catalogApi } from '@/lib/api/catalog';
import { formatMoney } from '@/lib/utils';
export function Search() {
  const pathname = usePathname();
  const params = useSearchParams();
  const initialValue =
    pathname === '/catalog' || pathname?.startsWith('/catalog/') || pathname === '/teaware'
      ? (params?.get('q')?.trim() ?? '')
      : '';
  return (
    <SearchInput key={`${pathname}?${params?.toString() ?? ''}`} initialValue={initialValue} />
  );
}
function SearchInput({ initialValue }: { initialValue: string }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [debounced, setDebounced] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const id = useId();
  const query = value.trim();
  const typing = query !== debounced;
  const showSuggestions = open && query.length >= 2;
  const href = searchHref(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 250);
    return () => clearTimeout(timer);
  }, [value]);
  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: ({ signal }) =>
      catalogApi.products({ q: debounced, pageSize: 4, section: 'ALL' }, signal),
    enabled: debounced.length >= 2 && open && !typing,
  });
  return (
    <div
      className="search-wrap"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <form
        action="/catalog"
        role="search"
        className="header-search"
        onSubmit={(event) => {
          event.preventDefault();
          setOpen(false);
          router.push(href);
        }}
      >
        <input type="hidden" name="section" value="ALL" />
        <label className="sr-only" htmlFor={id}>
          {t('search')}
        </label>
        <input
          id={id}
          name="q"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder={t('searchPlaceholder')}
          maxLength={100}
          autoComplete="off"
          aria-controls={showSuggestions ? `${id}-results` : undefined}
        />
        <button type="submit" className="search-submit" aria-label={t('search')}>
          <SearchIcon size={19} aria-hidden="true" />
        </button>
      </form>
      {showSuggestions && (
        <div className="search-results" id={`${id}-results`}>
          <p className="eyebrow">{t('searchResults')}</p>
          {typing || results.isFetching || results.isPending ? (
            <div
              className="search-skeleton skeleton"
              role="status"
              aria-label={t('searchLoading')}
            />
          ) : results.isError ? (
            <p>{t('searchError')}</p>
          ) : !results.data?.items.length ? (
            <p>{t('noResults')}</p>
          ) : (
            <ul>
              {results.data.items.map((product) => (
                <li key={product.id}>
                  <Link href={`/product/${product.slug}`} onClick={() => setOpen(false)}>
                    <span>{product.name}</span>
                    <span className="muted">{formatMoney(product.minPrice)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className="text-link" href={href} onClick={() => setOpen(false)}>
            {t('viewSearchResults', { query })}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
