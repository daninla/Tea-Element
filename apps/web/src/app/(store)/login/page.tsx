import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AuthPage } from '@/features/account/auth-page';
export async function generateMetadata() {
  const t = await getTranslations('account');
  return {
    title: t('title.login'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}
export default async function Page() {
  const t = await getTranslations('account');
  return (
    <Suspense fallback={<p role="status">{t('loading')}</p>}>
      <AuthPage mode="login" />
    </Suspense>
  );
}
