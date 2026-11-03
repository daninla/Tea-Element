'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from './cart-store';
import { useCartQuote } from './use-cart-quote';
import { formatMoney } from '@/lib/utils';
import { Button } from '@/components/ui/button';
export function CartContents({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const t = useTranslations('cart');
  const cart = useCart();
  const quote = useCartQuote();
  if (!quote.mounted)
    return (
      <div className="cart-skeleton" role="status">
        {t('loading')}
      </div>
    );
  if (!cart.items.length)
    return (
      <div className="cart-empty">
        <span aria-hidden="true">茶</span>
        <h2>{t('empty')}</h2>
        <p>{t('emptyText')}</p>
        <Button asChild>
          <Link href="/catalog" onClick={onNavigate}>
            {t('explore')}
          </Link>
        </Button>
      </div>
    );
  if (quote.isPending)
    return (
      <div className="cart-skeleton" role="status">
        {t('loading')}
      </div>
    );
  if (quote.isError || !quote.data)
    return (
      <div className="cart-empty">
        <p role="alert">{t('error')}</p>
        <Button onClick={() => void quote.refetch()}>{t('retry')}</Button>
      </div>
    );
  const data = quote.data;
  const blocked = data.unavailableVariantIds.length > 0 || data.items.some((x) => !x.inStock);
  return (
    <div className={compact ? 'cart-contents compact' : 'cart-contents'}>
      {quote.changed && (
        <p className="notice" role="status">
          {t('priceChanged')}
        </p>
      )}
      <div className="cart-lines">
        {cart.items.map((item) => {
          const line = data.items.find((x) => x.variantId === item.variantId);
          return (
            <article className="cart-line" key={item.variantId}>
              <div>
                <Link
                  className="cart-line-name"
                  href={
                    line
                      ? `/product/${line.slug}${line.weightGrams === null ? '' : `?weight=${line.weightGrams}`}`
                      : '/catalog'
                  }
                  onClick={onNavigate}
                >
                  {line?.name ?? t('removedProduct')}
                </Link>
                {line && (
                  <p>
                    {line.weightGrams === null
                      ? t('piece')
                      : t('portion', { weight: line.weightGrams })}{' '}
                    · {formatMoney(line.unitPrice)}
                  </p>
                )}
                {(!line || !line.inStock) && <p className="field-error">{t('stockError')}</p>}
              </div>
              <div className="quantity-control">
                <button
                  aria-label={t('decrease', { name: line?.name ?? t('removedProduct') })}
                  onClick={() => cart.setQuantity(item.variantId, item.quantity - 1)}
                  disabled={item.quantity <= 1}
                >
                  <Minus size={14} />
                </button>
                <span aria-live="polite">{item.quantity}</span>
                <button
                  aria-label={t('increase', { name: line?.name ?? t('removedProduct') })}
                  onClick={() => cart.setQuantity(item.variantId, item.quantity + 1)}
                  disabled={item.quantity >= 99}
                >
                  <Plus size={14} />
                </button>
              </div>
              <strong>{line ? formatMoney(line.unitPrice * item.quantity) : '—'}</strong>
              <button
                className="remove-line"
                aria-label={t('remove', { name: line?.name ?? t('removedProduct') })}
                onClick={() => cart.remove(item.variantId)}
              >
                <Trash2 size={17} />
              </button>
            </article>
          );
        })}
      </div>
      <div className="cart-totals">
        <p>
          <span>{t('subtotal')}</span>
          <span>{formatMoney(data.subtotal)}</span>
        </p>
        <p>
          <span>{t('discount')}</span>
          <span>−{formatMoney(data.discount)}</span>
        </p>
        <p className="cart-grand-total">
          <span>{t('total')}</span>
          <strong>{formatMoney(data.total)}</strong>
        </p>
        <small>{t('deliveryNote')}</small>
      </div>
      {blocked ? (
        <p className="notice" role="alert">
          {t('adjustStock')}
        </p>
      ) : (
        <Button asChild>
          <Link href="/checkout" onClick={onNavigate}>
            {t('checkout')}
          </Link>
        </Button>
      )}
      <p className="muted-copy">{t('serverPrice')}</p>
    </div>
  );
}
