import { notFound } from 'next/navigation';
import { AdminPaymentDetailPage } from '@/features/admin/admin-payment-detail-page';
import { paymentReturn } from '@/features/admin/payment-admin-filters';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const q = await searchParams;
  return (
    <AdminPaymentDetailPage
      id={id}
      returnTo={paymentReturn(typeof q.returnTo === 'string' ? q.returnTo : undefined)}
    />
  );
}
