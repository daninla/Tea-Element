import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { CustomerDetailPage } from '@/features/admin/customer-detail-page';
import { customerReturn } from '@/features/admin/customer-filters';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[]; returnTo?: string | string[] }>;
}) {
  const p = await searchParams,
    email = z.string().trim().toLowerCase().email().max(320).safeParse(p.email);
  if (!email.success) notFound();
  return (
    <Suspense>
      <CustomerDetailPage
        key={email.data}
        customer={{ kind: 'GUEST', email: email.data }}
        returnTo={customerReturn(typeof p.returnTo === 'string' ? p.returnTo : undefined)}
      />
    </Suspense>
  );
}
