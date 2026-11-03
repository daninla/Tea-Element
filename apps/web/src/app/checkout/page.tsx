import { getTranslations } from 'next-intl/server';
import { CheckoutPage } from '@/features/checkout/checkout-page';
export async function generateMetadata() {
  const t = await getTranslations('checkout');
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}
export default CheckoutPage;
