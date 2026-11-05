import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { AdminOrdersPage } from '@/features/admin/admin-orders-page';
export default async function Page() {
  const t = await getTranslations('admin');
  return (
    <Suspense fallback={<p role="status">{t('loading')}</p>}>
      <AdminOrdersPage />
    </Suspense>
  );
}
