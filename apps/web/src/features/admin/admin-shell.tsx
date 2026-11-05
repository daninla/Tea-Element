'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ordersApi } from '@/lib/api/orders';
export function AdminShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations('admin');
  const pathname = usePathname();
  const session = useQuery({ queryKey: ['customer-session'], queryFn: ordersApi.me, retry: false });
  if (session.isPending || session.isFetching)
    return (
      <main id="main-content" className="container commerce-page">
        <p role="status">{t('loading')}</p>
      </main>
    );
  if (session.isError || session.data?.role !== 'ADMIN')
    return (
      <main id="main-content" className="container commerce-page">
        <h1>{t('denied')}</h1>
        <Link href="/login?next=/admin/orders">{t('login')}</Link>
      </main>
    );
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="brand">
          {t('brand')}
        </Link>
        <p className="eyebrow">{t('panel')}</p>
        <nav aria-label={t('navigation')}>
          <Link
            href="/admin/orders"
            aria-current={pathname.startsWith('/admin/orders') ? 'page' : undefined}
          >
            {t('orders')}
          </Link>
          <Link
            href="/admin/inventory"
            aria-current={pathname.startsWith('/admin/inventory') ? 'page' : undefined}
          >
            {t('inventory')}
          </Link>
          <Link href="/account">{t('account')}</Link>
          <Link href="/">{t('store')}</Link>
        </nav>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <span>{t('demo')}</span>
          <span>{session.data.firstName}</span>
        </header>
        <main id="main-content" className="admin-main">
          {children}
        </main>
      </div>
    </div>
  );
}
