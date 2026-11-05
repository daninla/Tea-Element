import { SiteHeader } from '@/features/navigation/site-header';
import { SiteFooter } from '@/features/navigation/site-footer';
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </>
  );
}
