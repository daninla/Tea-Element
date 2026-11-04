import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AccountPage } from '@/features/account/account-page';
export async function generateMetadata() {
  const t = await getTranslations('account');
  return {
    title: t('title.account'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}
export default async function Page() {
  const t = await getTranslations('account');
  return (
    <Suspense fallback={<p role="status">{t('loading')}</p>}>
      <AccountPage />
    </Suspense>
  );
}
