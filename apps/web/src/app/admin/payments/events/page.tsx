import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { PaymentEvents } from '@/features/admin/payment-events';
export default async function Page() {
  const t = await getTranslations('paymentAdmin');
  return (
    <>
      <Link className="text-link" href="/admin/payments">
        {t('back')}
      </Link>
      <h1>{t('allEvents')}</h1>
      <PaymentEvents />
    </>
  );
}
