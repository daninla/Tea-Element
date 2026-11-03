import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Leaf, Sprout, Coffee } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { catalogApi } from '@/lib/api/catalog';
import { getCategories } from '@/lib/api/server-catalog';
import { Button } from '@/components/ui/button';
import { ProductCard } from '@/features/catalog/product-card';
import { StatePanel } from '@/features/catalog/state-panel';
const characters: Record<string, string> = {
  puer: '普',
  oolong: '乌',
  green: '绿',
  red: '红',
  white: '白',
  gaba: '静',
  herbal: '花',
};
export async function HomePage() {
  const t = await getTranslations('home');
  const common = await getTranslations('common');
  const [categories, sales, recent] = await Promise.all([
    getCategories().catch(() => []),
    catalogApi.products({ onSale: true, pageSize: 4, sort: 'price_asc' }).catch(() => null),
    catalogApi.products({ pageSize: 4, sort: 'newest' }).catch(() => null),
  ]);
  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <p className="eyebrow">{t('eyebrow')}</p>
          <h1>{t('title')}</h1>
          <p className="hero-description">{t('description')}</p>
          <div className="hero-actions">
            <Button asChild>
              <Link href="/catalog">
                {t('cta')}
                <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </Button>
            <a className="text-link" href="#categories">
              {t('secondary')}
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <Image
            src="/images/tea-ritual.png"
            alt={t('heroAlt')}
            fill
            priority
            sizes="(max-width: 640px) 100vw, 50vw"
          />
          <span className="hero-caption">{t('heroCaption')}</span>
        </div>
      </section>
      <div className="container benefits">
        {[Leaf, Sprout, Coffee].map((Icon, i) => {
          const key = ['One', 'Two', 'Three'][i]!;
          return (
            <div className="benefit" key={key}>
              <Icon size={25} strokeWidth={1.2} aria-hidden="true" />
              <div>
                <strong>{t(`benefit${key}`)}</strong>
                <p>{t(`benefit${key}Text`)}</p>
              </div>
            </div>
          );
        })}
      </div>
      <section className="container section" id="categories">
        <p className="eyebrow">{t('collectionLabel')}</p>
        <h2 style={{ marginTop: 12 }}>{t('collectionTitle')}</h2>
        <p className="section-description">{t('collectionDescription')}</p>
        <div className="category-grid">
          {categories.map((c) => (
            <Link key={c.id} href={`/catalog/${c.slug}`} className="category-tile">
              <span className="category-character" aria-hidden="true">
                {characters[c.slug] ?? '茶'}
              </span>
              <strong>{c.name}</strong>
              <small>{t('categoryCount', { count: c.productsCount })}</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('saleEyebrow')}</p>
            <h2>{t('saleTitle')}</h2>
            <p className="section-description">{t('saleDescription')}</p>
          </div>
          <Link href="/catalog?onSale=true" className="text-link">
            {common('allTea')}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {sales ? (
          <div className="product-grid">
            {sales.items.map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
          </div>
        ) : (
          <StatePanel />
        )}
      </section>
      <section className="ritual" id="ritual">
        <div className="container ritual-grid">
          <div>
            <p className="eyebrow">{t('ritualEyebrow')}</p>
            <h2>{t('ritualTitle')}</h2>
            <p className="ritual-text">{t('ritualText')}</p>
          </div>
          <ol className="ritual-steps">
            {['One', 'Two', 'Three'].map((key, i) => (
              <li key={key}>
                <span className="step-number" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3>{t(`step${key}`)}</h3>
                  <p>{t(`step${key}Text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="container section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{t('newEyebrow')}</p>
            <h2>{t('newTitle')}</h2>
            <p className="section-description">{t('newDescription')}</p>
          </div>
          <Link href="/catalog?sort=newest" className="text-link">
            {common('catalog')}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        {recent ? (
          <div className="product-grid">
            {recent.items.map((p) => (
              <ProductCard product={p} key={p.id} />
            ))}
          </div>
        ) : (
          <StatePanel />
        )}
      </section>
    </>
  );
}
