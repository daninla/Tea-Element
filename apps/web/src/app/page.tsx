import { Leaf } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
export default async function Home() {
  const t = await getTranslations('foundation');
  return (
    <div className="shell">
      <header>
        <span className="wordmark">
          <Leaf aria-hidden="true" size={24} />
          {t('title')}
        </span>
        <span className="locale">{t('language')}</span>
      </header>
      <main>
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p className="intro">{t('description')}</p>
        <div className="notice">
          <span className="dot" aria-hidden="true" />
          <strong>{t('status')}</strong>
          <p>{t('detail')}</p>
        </div>
      </main>
      <footer>{t('footer')}</footer>
    </div>
  );
}
