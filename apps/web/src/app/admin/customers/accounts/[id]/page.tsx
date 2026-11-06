import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { CustomerDetailPage } from '@/features/admin/customer-detail-page';
import { customerReturn } from '@/features/admin/customer-filters';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const p = await searchParams;
  return (
    <Suspense>
      <CustomerDetailPage
        key={id}
        customer={{ kind: 'ACCOUNT', id }}
        returnTo={customerReturn(typeof p.returnTo === 'string' ? p.returnTo : undefined)}
      />
    </Suspense>
  );
}
