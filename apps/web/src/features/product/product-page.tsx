import { productHref, categoryHref } from '@/lib/catalog-links';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight, Thermometer, Timer, Waves } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { catalogApi, GatewayError } from '@/lib/api/catalog';
import { getProduct } from '@/lib/api/server-catalog';
import { ProductCard } from '@/features/catalog/product-card';
import { productImage } from '@/features/catalog/product-image';
import { StatePanel } from '@/features/catalog/state-panel';
import { ProductGallery } from './product-gallery';
import { PortionSelector } from './portion-selector';
import { serializeJsonLd } from './selection';
export async function ProductPage({ slug, weight }: { slug: string; weight?: string }) {
  const t = await getTranslations('product');
  const common = await getTranslations('common');
  let product;
  try {
    product = await getProduct(slug);
  } catch (error) {
    if (error instanceof GatewayError && error.status === 404) notFound();
    return (
      <section className="container section">
        <StatePanel />
      </section>
    );
  }
  const related = await catalogApi
    .products({
      category: product.category.slug,
      pageSize: 4,
      section: product.category.section ?? 'TEA',
    })
    .catch(() => null);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    image: new URL(productImage(product), base).href,
    category: product.category.name,
    offers: product.variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      price: (v.price / 100).toFixed(2),
      priceCurrency: 'UAH',
      availability: `https://schema.org/${v.inStock ? 'InStock' : 'OutOfStock'}`,
      url: new URL(productHref(product.slug, v.weightGrams), base).href,
    })),
  };
  return (
    <section className="container detail-section">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <nav className="breadcrumbs" aria-label={common('catalog')}>
        <Link href="/">{common('home')}</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <Link href="/catalog">{common('catalog')}</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <Link href={categoryHref(product.category)}>{product.category.name}</Link>
        <ChevronRight size={12} aria-hidden="true" />
        <span>{product.name}</span>
      </nav>
      <div className="product-detail">
        <ProductGallery product={product} />
        <div className="detail-copy">
          <p className="eyebrow">
            {product.category.name} · {product.origin}
          </p>
          <h1>{product.name}</h1>
          {product.nameOriginal && <p className="detail-original">{product.nameOriginal}</p>}
          <p className="detail-description">{product.description}</p>
          <PortionSelector variants={product.variants} initialWeight={weight} />
          <dl className="product-facts">
            <div>
              <dt>{t('origin')}</dt>
              <dd>{product.origin}</dd>
            </div>
            {product.year && (
              <div>
                <dt>{t('year')}</dt>
                <dd>{product.year}</dd>
              </div>
            )}
            <div>
              <dt>{t('category')}</dt>
              <dd>{product.category.name}</dd>
            </div>
          </dl>
        </div>
      </div>
      {product.brewingGuide && (
        <div className="brewing-panel">
          <div>
            <p className="eyebrow">{t('about')}</p>
            <h2>{t('brewing')}</h2>
          </div>
          <div className="brewing-stats">
            {[
              {
                Icon: Thermometer,
                label: t('temperature'),
                value: t('degrees', { value: product.brewingGuide.temperatureCelsius }),
              },
              {
                Icon: Timer,
                label: t('seconds'),
                value: t('time', { value: product.brewingGuide.seconds }),
              },
              {
                Icon: Waves,
                label: t('infusions'),
                value: t('times', { value: product.brewingGuide.infusions }),
              },
            ].map(({ Icon, label, value }) => (
              <div key={label}>
                <Icon size={23} strokeWidth={1.2} aria-hidden="true" />
                <p>{label}</p>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
      {related && related.items.some((p) => p.id !== product.id) && (
        <section className="section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t('relatedEyebrow')}</p>
              <h2>{t('related')}</h2>
            </div>
            <Link className="text-link" href={categoryHref(product.category)}>
              {product.category.name}
            </Link>
          </div>
          <div className="product-grid">
            {related.items
              .filter((p) => p.id !== product.id)
              .map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
          </div>
        </section>
      )}
    </section>
  );
}
