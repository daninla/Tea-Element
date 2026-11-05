import { Suspense } from 'react';
import { CategoryAdminPage } from '@/features/admin/category-admin-page';
export default function Page() {
  return (
    <Suspense>
      <CategoryAdminPage />
    </Suspense>
  );
}
