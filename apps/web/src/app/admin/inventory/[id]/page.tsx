import { notFound } from 'next/navigation';
import { InventoryDetailPage } from '@/features/admin/inventory-detail-page';
import { inventoryReturn } from '@/features/admin/inventory-schema';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const search = await searchParams;
  return (
    <InventoryDetailPage
      key={id}
      id={id}
      returnTo={inventoryReturn(typeof search.returnTo === 'string' ? search.returnTo : undefined)}
    />
  );
}
