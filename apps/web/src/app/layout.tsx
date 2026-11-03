import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { NextIntlClientProvider } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { Providers } from '@/components/providers';
import { SiteHeader } from '@/features/navigation/site-header';
import { SiteFooter } from '@/features/navigation/site-footer';
import './globals.css';
const inter = localFont({
  src: '../assets/fonts/inter.ttf',
  variable: '--font-inter',
  display: 'swap',
});
const cormorant = localFont({
  src: '../assets/fonts/cormorant-garamond.ttf',
  variable: '--font-heading',
  display: 'swap',
});
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    robots: { index: false, follow: false },
    openGraph: {
      title: t('title'),
      description: t('description'),
      locale: 'uk_UA',
      type: 'website',
    },
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const common = await getTranslations('common');
  return (
    <html lang="uk" className={`${inter.variable} ${cormorant.variable}`}>
      <body>
        <NextIntlClientProvider>
          <Providers>
            <a className="skip-link" href="#main-content">
              {common('skip')}
            </a>
            <SiteHeader />
            <main id="main-content">{children}</main>
            <SiteFooter />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
