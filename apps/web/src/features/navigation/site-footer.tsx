import Link from 'next/link';
import { Leaf, ArrowUpRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
export async function SiteFooter() {
  const t = await getTranslations('nav');
  const common = await getTranslations('common');
  return (
    <footer className="site-footer">
      <div className="container footer-top">
        <div>
          <Link className="brand" href="/">
            <Leaf size={26} strokeWidth={1.3} aria-hidden="true" />
            <span>{common('brand')}</span>
          </Link>
          <p className="footer-tagline">{t('footerText')}</p>
          <p className="footer-description">{t('footerDescription')}</p>
        </div>
        <div className="footer-links">
          <p className="eyebrow">{t('explore')}</p>
          <Link href="/catalog">
            {common('catalog')}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/teaware">{common('equipment')}</Link>
          <Link href="/#ritual">
            {t('brewing')}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
        <div className="footer-mark" aria-hidden="true">
          茶
        </div>
      </div>
      <div className="container footer-bottom">
        <span>{t('copyright', { year: new Date().getFullYear() })}</span>
        <span>{t('madeFor')}</span>
        <span>{common('currency')}</span>
      </div>
    </footer>
  );
}
