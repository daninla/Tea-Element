import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProduct } from '@/lib/api/server-catalog';
import { GatewayError } from '@/lib/api/catalog';
import { productImage } from '@/features/catalog/product-image';
import { ProductPage } from '@/features/product/product-page';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getProduct(slug);
    return {
      title: product.name,
      description: product.description,
      alternates: { canonical: `/product/${product.slug}` },
      openGraph: {
        title: product.name,
        description: product.description,
        images: [{ url: productImage(product), alt: product.name }],
      },
    };
  } catch (error) {
    if (error instanceof GatewayError && error.status === 404) notFound();
    return {};
  }
}
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const { weight } = await searchParams;
  return <ProductPage slug={slug} weight={typeof weight === 'string' ? weight : undefined} />;
}
