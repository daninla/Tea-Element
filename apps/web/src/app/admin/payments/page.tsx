import { Suspense } from 'react';
import { AdminPaymentsPage } from '@/features/admin/admin-payments-page';
export default function Page() {
  return (
    <Suspense>
      <AdminPaymentsPage />
    </Suspense>
  );
}
