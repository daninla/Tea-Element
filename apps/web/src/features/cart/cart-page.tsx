'use client';
import { useTranslations } from 'next-intl';
import { CartContents } from './cart-contents';
export function CartPage() {
  const t = useTranslations('cart');
  return (
    <section className="container commerce-page">
      <p className="eyebrow">{t('eyebrow')}</p>
      <h1>{t('title')}</h1>
      <CartContents />
    </section>
  );
}
