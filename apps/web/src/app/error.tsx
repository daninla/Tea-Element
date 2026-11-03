'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  const t = useTranslations('common');
  return (
    <section className="container section">
      <div className="state-panel">
        <h2>{t('unavailable')}</h2>
        <p>{t('unavailableDetail')}</p>
        <Button variant="outline" onClick={reset}>
          {t('retry')}
        </Button>
      </div>
    </section>
  );
}
