import { z } from 'zod';
import { getTranslations } from 'next-intl/server';
import { CheckoutPage } from '@/features/checkout/checkout-page';
export async function generateMetadata() {
  const t = await getTranslations('checkout');
  return { title: t('title'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}
const directSelection = z.object({
  variant: z.string().uuid(),
  quantity: z.string().regex(/^[1-9][0-9]?$/),
});

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (params.variant === undefined && params.quantity === undefined) return <CheckoutPage />;
  const parsed = directSelection.safeParse(params);
  return (
    <CheckoutPage
      directItems={
        parsed.success
          ? [{ variantId: parsed.data.variant, quantity: Number(parsed.data.quantity) }]
          : []
      }
    />
  );
}
