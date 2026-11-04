'use client';
import Link from 'next/link';
import { UserRound } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ordersApi } from '@/lib/api/orders';
export function AccountLink() {
  const t = useTranslations('account');
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  return (
    <Link
      href={session.data ? '/account' : '/login'}
      className="account-link"
      aria-label={t(session.data ? 'cabinet' : 'loginLink')}
    >
      <UserRound size={21} aria-hidden="true" />
      <span>{t(session.data ? 'cabinet' : 'loginLink')}</span>
    </Link>
  );
}
