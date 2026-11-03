'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
export function FilterDrawer({
  children,
  equipment = false,
}: {
  children: React.ReactNode;
  equipment?: boolean;
}) {
  const t = useTranslations('catalog');
  const common = useTranslations('common');
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal size={15} aria-hidden="true" />
          {t('filters')}
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content className="filter-drawer">
          <div className="drawer-header">
            <Dialog.Title>{t(equipment ? 'equipmentFilterTitle' : 'filterTitle')}</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label={common('close')}>
                <X size={20} aria-hidden="true" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {t(equipment ? 'equipmentDescription' : 'description')}
          </Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
