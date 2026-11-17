import { Suspense } from 'react';
import { AccountLink } from '@/features/account/account-link';
import { CartButton } from '@/features/cart/cart-button';
import Link from 'next/link';
import { Leaf, ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getCategories } from '@/lib/api/server-catalog';
import { Search } from './search';
export async function SiteHeader() {
  const common = await getTranslations('common');
  const t = await getTranslations('nav');
  const categories = await getCategories().catch(() => []);
  return (
    <header className="site-header">
      <div className="container header-main">
        <Link href="/" className="brand" aria-label={common('brand')}>
          <span className="brand-symbol">
            <Leaf size={27} strokeWidth={1.3} aria-hidden="true" />
          </span>
          <span>{common('brand')}</span>
        </Link>
        <div className="header-search-area">
          <Suspense
            fallback={
              <div className="header-search skeleton" aria-hidden="true" style={{ height: 36 }} />
            }
          >
            <Search />
          </Suspense>
        </div>
        <AccountLink />
        <CartButton />
        <Link href="/catalog" className="header-catalog">
          {common('catalog')}
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <nav className="category-nav container" aria-label={t('tea')}>
        <Link href="/catalog">{common('allTea')}</Link>
        <Link href="/teaware" className="equipment-nav-link">
          {common('equipment')}
        </Link>
        {categories
          .filter((c) => (c.section ?? 'TEA') === 'TEA')
          .map((c) => (
            <Link key={c.id} href={`/catalog/${c.slug}`}>
              {c.name}
            </Link>
          ))}

        <Link href="/#ritual" className="ritual-link">
          {t('ritual')}
        </Link>
      </nav>
    </header>
  );
}
