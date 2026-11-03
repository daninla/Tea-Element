import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import './globals.css';
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return {
    title: t('title'),
    description: t('description'),
    robots: { index: false, follow: false },
  };
}
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
