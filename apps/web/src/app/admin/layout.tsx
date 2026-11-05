import { AdminShell } from '@/features/admin/admin-shell';
import { getTranslations } from 'next-intl/server';
export async function generateMetadata() {
  const t = await getTranslations('admin');
  return { title: t('panel'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
