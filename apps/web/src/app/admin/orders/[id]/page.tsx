import { adminOrdersReturn } from '@/features/admin/order-filters';
import { notFound } from 'next/navigation';
import { AdminOrderPage } from '@/features/admin/admin-order-page';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const query = await searchParams;
  return (
    <AdminOrderPage
      id={id}
      returnTo={adminOrdersReturn(typeof query.returnTo === 'string' ? query.returnTo : undefined)}
    />
  );
}
