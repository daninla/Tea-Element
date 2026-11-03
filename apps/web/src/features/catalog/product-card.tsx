'use client';
import { productHref } from '@/lib/catalog-links';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProductView } from '@tea/contracts';
import { formatMoney } from '@/lib/utils';
import { productImage } from './product-image';
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductView;
  priority?: boolean;
}) {
  const t = useTranslations('common');
  const [selected, setSelected] = useState(product.variants[0]?.id);
  const variant = product.variants.find((v) => v.id === selected) ?? product.variants[0];
  if (!variant) return null;
  const href = productHref(product.slug, variant.weightGrams);
  return (
    <article className="product-card">
      <Link className="product-image" href={href} aria-label={`${t('details')}: ${product.name}`}>
        <Image
          src={productImage(product)}
          alt={product.name}
          priority={priority}
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1000px) 30vw, 24vw"
        />
        {!product.inStock ? (
          <span className="badge">{t('outOfStock')}</span>
        ) : product.onSale ? (
          <span className="badge badge-sale">{t('sale')}</span>
        ) : null}
      </Link>
      <p className="product-meta">
        {product.category.name} · {product.origin}
      </p>
      <h3>
        <Link href={href}>{product.name}</Link>
      </h3>
      {product.nameOriginal && <p className="product-original">{product.nameOriginal}</p>}
      <div className="card-portions" role="group" aria-label={product.name}>
        {product.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={v.id === variant.id}
            onClick={() => setSelected(v.id)}
          >
            {v.weightGrams === null ? t('piece') : t('grams', { weight: v.weightGrams })}
          </button>
        ))}
      </div>
      <div className="product-card-bottom">
        <p className="card-price">
          {formatMoney(variant.price)}
          {variant.onSale && (
            <span className="old-price">{formatMoney(variant.originalPrice)}</span>
          )}
        </p>
        <Link className="card-arrow" href={href} aria-label={`${t('details')}: ${product.name}`}>
          <ArrowUpRight size={17} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
