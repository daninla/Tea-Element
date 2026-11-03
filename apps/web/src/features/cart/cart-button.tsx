'use client';
import { useState } from 'react';
import Link from 'next/link';
import * as Dialog from '@radix-ui/react-dialog';
import { ShoppingBag, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCart } from './cart-store';
import { useMounted } from './use-mounted';
import { CartContents } from './cart-contents';
export function CartButton() {
  const t = useTranslations('cart');
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const count = useCart((s) => s.items.reduce((n, x) => n + x.quantity, 0));
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="cart-trigger"
        aria-label={t('open', { count: mounted ? count : 0 })}
      >
        <ShoppingBag size={21} aria-hidden="true" />
        <span>{mounted ? count : 0}</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="filter-overlay" />
        <Dialog.Content className="cart-drawer">
          <div className="drawer-heading">
            <Dialog.Title>{t('title')}</Dialog.Title>
            <Dialog.Close aria-label={t('close')} className="icon-button">
              <X size={21} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="muted-copy">{t('description')}</Dialog.Description>
          <CartContents compact onNavigate={() => setOpen(false)} />
          <Dialog.Close asChild>
            <Link href="/cart" className="text-link">
              {t('viewCart')}
            </Link>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
