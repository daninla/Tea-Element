'use client';
import { useEffect, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { catalogApi } from '@/lib/api/catalog';
import { formatMoney } from '@/lib/utils';
export function Search() {
  const t = useTranslations('nav');
  const [value, setValue] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 250);
    return () => clearTimeout(timer);
  }, [value]);
  const results = useQuery({
    queryKey: ['search', debounced],
    queryFn: ({ signal }) => catalogApi.products({ q: debounced, pageSize: 4 }, signal),
    enabled: debounced.length >= 2 && open,
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
        onSubmit={() => setOpen(false)}
      >
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
          aria-controls={open && debounced.length >= 2 ? `${id}-results` : undefined}
        />
        <button type="submit" className="search-submit" aria-label={t('search')}>
          <SearchIcon size={19} aria-hidden="true" />
        </button>
      </form>
      {open && debounced.length >= 2 && (
        <div className="search-results" id={`${id}-results`}>
          <p className="eyebrow">{t('searchResults')}</p>
          {results.isError ? (
            <p>{t('viewAll')}</p>
          ) : results.isFetching ? (
            <div className="search-skeleton skeleton" />
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
          <Link
            className="text-link"
            href={`/catalog?q=${encodeURIComponent(value.trim())}`}
            onClick={() => setOpen(false)}
          >
            {t('viewAll')}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
