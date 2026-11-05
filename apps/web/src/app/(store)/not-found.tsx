import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
export default async function NotFound() {
  const t = await getTranslations('common');
  return (
    <section className="container section">
      <div className="state-panel">
        <h1>{t('notFound')}</h1>
        <p>{t('notFoundDetail')}</p>
        <Button asChild>
          <Link href="/catalog">{t('backCatalog')}</Link>
        </Button>
      </div>
    </section>
  );
}
