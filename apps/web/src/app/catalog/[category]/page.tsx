import type { Metadata } from 'next';
import { getCategories } from '@/lib/api/server-catalog';
import { CatalogPage } from '@/features/catalog/catalog-page';
import type { RawCatalogQuery } from '@/features/catalog/catalog-query';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const entry = (await getCategories().catch(() => [])).find((c) => c.slug === category);
  return {
    title: entry?.name,
    description: entry?.description,
    alternates: { canonical: `/catalog/${encodeURIComponent(category)}` },
  };
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<RawCatalogQuery>;
}) {
  const { category } = await params;
  return <CatalogPage raw={await searchParams} category={category} />;
}
