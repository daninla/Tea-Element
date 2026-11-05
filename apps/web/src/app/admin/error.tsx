'use client';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
export default function AdminError({ reset }: { reset: () => void }) {
  const t = useTranslations('admin');
  return (
    <>
      <h1>{t('error')}</h1>
      <Button onClick={reset}>{t('retry')}</Button>
    </>
  );
}
