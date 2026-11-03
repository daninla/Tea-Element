import { getTranslations } from 'next-intl/server';
import { CatalogPage } from '@/features/catalog/catalog-page';
import type { RawCatalogQuery } from '@/features/catalog/catalog-query';
export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const t = await getTranslations('catalog');
  return {
    title: t('equipmentTitle'),
    description: t('equipmentDescription'),
    alternates: { canonical: '/teaware' },
  };
}
export default async function Page({ searchParams }: { searchParams: Promise<RawCatalogQuery> }) {
  return <CatalogPage raw={await searchParams} section="EQUIPMENT" />;
}
