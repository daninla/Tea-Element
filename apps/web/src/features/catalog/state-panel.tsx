import Link from 'next/link';
import { Leaf } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
export async function StatePanel({
  kind = 'unavailable',
}: {
  kind?: 'unavailable' | 'empty' | 'invalid';
}) {
  const common = await getTranslations('common');
  const t = await getTranslations('catalog');
  return (
    <div className="state-panel">
      <Leaf size={32} strokeWidth={1.2} aria-hidden="true" />
      <h2>{kind === 'unavailable' ? common('unavailable') : t(kind)}</h2>
      <p>{kind === 'unavailable' ? common('unavailableDetail') : t(`${kind}Detail`)}</p>
      <Button asChild variant="outline">
        <Link href="/catalog">{kind === 'unavailable' ? common('retry') : common('allTea')}</Link>
      </Button>
    </div>
  );
}
