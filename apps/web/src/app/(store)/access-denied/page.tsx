import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
export default async function Page() {
  const t = await getTranslations('admin');
  return (
    <section className="container commerce-page">
      <h1>{t('denied')}</h1>
      <Link href="/account" className="text-link">
        {t('account')}
      </Link>
      <p>
        <Link href="/admin/orders" className="text-link">
          {t('retry')}
        </Link>
      </p>
    </section>
  );
}
