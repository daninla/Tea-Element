'use client';
import { useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ProductView } from '@tea/contracts';
import { productImage } from '@/features/catalog/product-image';
export function ProductGallery({ product }: { product: ProductView }) {
  const t = useTranslations('product');
  const common = useTranslations('common');
  const [selected, setSelected] = useState(0);
  const primary = productImage(product);
  const local = product.images.filter((path) => path.startsWith('/') && !path.startsWith('//'));
  const images = [...new Set([primary, ...(local.length ? local : ['/images/tea-ritual.png'])])];
  const current = images[selected] ?? primary;
  return (
    <div className="product-gallery">
      <div className="detail-image">
        <Image
          src={current}
          alt={`${product.name} — ${common('illustrative')}`}
          fill
          priority
          sizes="(max-width: 640px) 100vw, 50vw"
        />
        {product.onSale && <span className="badge badge-sale">{common('sale')}</span>}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbnails" role="group" aria-label={t('gallery')}>
          {images.map((image, i) => (
            <button
              type="button"
              key={image}
              aria-label={t('photo', { number: i + 1 })}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <Image src={image} alt="" width={78} height={78} />
            </button>
          ))}
        </div>
      )}
      <p className="image-note">{t('imageNote')}</p>
    </div>
  );
}
