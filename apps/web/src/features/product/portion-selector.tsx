'use client';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/features/cart/cart-store';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
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
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const add = useCart((s) => s.add);
  const cartT = useTranslations('cart');
  const params = useSearchParams();
  const t = useTranslations('product');
  const common = useTranslations('common');
  const variant = selectedVariant(variants, params.get('weight') ?? initialWeight);
  if (!variant) return null;
  function select(weight: number | null) {
    setAdded(false);
    const url = new URL(window.location.href);
    if (weight === null) url.searchParams.delete('weight');
    else url.searchParams.set('weight', String(weight));
    window.history.replaceState(null, '', url);
  }
  return (
    <div className="portion-selector">
      <h2>{t(variant.weightGrams === null ? 'pieceChoose' : 'choose')}</h2>
      <div className="portion-options" role="group" aria-label={t('portionLabel')}>
        {variants.map((v) => (
          <button
            type="button"
            key={v.id}
            aria-pressed={v.id === variant.id}
            className={!v.inStock ? 'portion-unavailable' : ''}
            onClick={() => select(v.weightGrams)}
            aria-label={`${v.weightGrams === null ? `${common('piece')} — ${formatMoney(v.price)}` : t('portionPrice', { weight: v.weightGrams, price: formatMoney(v.price) })}${v.inStock ? '' : ` · ${common('outOfStock')}`}`}
          >
            <span>
              {v.weightGrams === null
                ? common('piece')
                : common('grams', { weight: v.weightGrams })}
            </span>
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
      <div className="purchase-controls">
        <label htmlFor="purchase-quantity">{cartT('quantity')}</label>
        <input
          id="purchase-quantity"
          type="number"
          min={1}
          max={99}
          value={quantity}
          onChange={(e) =>
            setQuantity(Math.max(1, Math.min(99, Math.trunc(Number(e.target.value)) || 1)))
          }
        />
        <div className="purchase-actions">
          {variant.inStock ? (
            <Button asChild>
              <Link href={{ pathname: '/checkout', query: { variant: variant.id, quantity } }}>
                {t('buyNow')}
              </Link>
            </Button>
          ) : (
            <Button disabled>{t('buyNow')}</Button>
          )}
          <Button
            variant="outline"
            className="purchase-add"
            disabled={!variant.inStock}
            onClick={() => {
              add(variant.id, quantity);
              setAdded(true);
            }}
          >
            {cartT('add')}
          </Button>
        </div>
      </div>
      {added && (
        <p className="added-notice" role="status">
          {cartT('added')} <Link href="/cart">{cartT('viewCart')}</Link>
        </p>
      )}
      <p className="ordering-note">
        <Info size={17} aria-hidden="true" />
        {t('orderingSoon')}
      </p>
    </div>
  );
}
