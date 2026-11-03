'use client';
import { useSearchParams } from 'next/navigation';
import { Check, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { VariantView } from '@tea/contracts';
import { formatMoney } from '@/lib/utils';
import { selectedVariant } from './selection';
export function PortionSelector({
  variants,
  initialWeight,
}: {
  variants: VariantView[];
  initialWeight?: string;
}) {
  const params = useSearchParams();
  const t = useTranslations('product');
  const common = useTranslations('common');
  const variant = selectedVariant(variants, params.get('weight') ?? initialWeight);
  if (!variant) return null;
  function select(weight: number) {
    const url = new URL(window.location.href);
    url.searchParams.set('weight', String(weight));
    window.history.replaceState(null, '', url);
  }
  return (
    <div className="portion-selector">
      <h2>{t('choose')}</h2>
      <div className="portion-options" role="group" aria-label={t('portionLabel')}>
        {variants.map((v) => (
          <button
            type="button"
            key={v.id}
            aria-pressed={v.id === variant.id}
            className={!v.inStock ? 'portion-unavailable' : ''}
            onClick={() => select(v.weightGrams)}
            aria-label={`${t('portionPrice', { weight: v.weightGrams, price: formatMoney(v.price) })}${v.inStock ? '' : ` · ${common('outOfStock')}`}`}
          >
            <span>{common('grams', { weight: v.weightGrams })}</span>
            <small>{formatMoney(v.price)}</small>
          </button>
        ))}
      </div>
      <div className="selection-summary" aria-live="polite">
        <p className="detail-price" aria-label={t('priceLabel')}>
          {formatMoney(variant.price)}
          {variant.onSale && (
            <span className="old-price">{formatMoney(variant.originalPrice)}</span>
          )}
        </p>
        <p className={`availability ${variant.inStock ? '' : 'unavailable'}`}>
          {variant.inStock && <Check size={14} aria-hidden="true" />}
          {variant.inStock ? common('inStock') : t('unavailablePortion')}
        </p>
      </div>
      <p className="ordering-note">
        <Info size={17} aria-hidden="true" />
        {t('orderingSoon')}
      </p>
    </div>
  );
}
