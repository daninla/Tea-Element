import { Suspense } from 'react';
import { CatalogListPage } from '@/features/admin/catalog-list-page';
export default function Page() {
  return (
    <Suspense>
      <CatalogListPage />
    </Suspense>
  );
}
