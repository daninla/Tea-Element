import NotFoundContent from './(store)/not-found';
import { SiteHeader } from '@/features/navigation/site-header';
import { SiteFooter } from '@/features/navigation/site-footer';
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <NotFoundContent />
      </main>
      <SiteFooter />
    </>
  );
}
