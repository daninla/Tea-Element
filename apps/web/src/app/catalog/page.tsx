import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CatalogPage } from '@/features/catalog/catalog-page';
import type { RawCatalogQuery } from '@/features/catalog/catalog-query';
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('catalog');
  return {
    title: t('title'),
    description: t('description'),
    alternates: { canonical: '/catalog' },
  };
}
export default async function Page({ searchParams }: { searchParams: Promise<RawCatalogQuery> }) {
  return <CatalogPage raw={await searchParams} />;
}
