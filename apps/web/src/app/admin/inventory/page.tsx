import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { InventoryListPage } from '@/features/admin/inventory-list-page';
export async function generateMetadata() {
  const t = await getTranslations('inventory');
  return { title: t('title') };
}
export default async function Page() {
  const t = await getTranslations('inventory');
  return (
    <Suspense fallback={<p role="status">{t('loading')}</p>}>
      <InventoryListPage />
    </Suspense>
  );
}
