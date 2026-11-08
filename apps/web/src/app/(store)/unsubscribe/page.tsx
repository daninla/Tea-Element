import { getTranslations } from 'next-intl/server';
import { UnsubscribePage } from '@/features/marketing/unsubscribe-page';
export async function generateMetadata() {
  const t = await getTranslations('marketing');
  return {
    title: t('unsubscribeTitle'),
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  };
}
export default function Page() {
  return <UnsubscribePage />;
}
