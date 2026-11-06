import { Suspense } from 'react';
import { CustomersPage } from '@/features/admin/customers-page';
export default function Page() {
  return (
    <Suspense>
      <CustomersPage />
    </Suspense>
  );
}
