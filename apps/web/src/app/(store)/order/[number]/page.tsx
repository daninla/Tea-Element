import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { OrderPage } from '@/features/orders/order-page';
export async function generateMetadata() {
  const t = await getTranslations('order');
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}
export default async function Page({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const t = await getTranslations('order');
  return (
    <Suspense fallback={<p role="status">{t('loading')}</p>}>
      <OrderPage number={number} />
    </Suspense>
  );
}
