import { getTranslations } from 'next-intl/server';
export default async function Page() {
  const t = await getTranslations('terms');
  return (
    <section className="container commerce-page">
      <h1>{t('title')}</h1>
      <p>{t('demo')}</p>
      <h2>{t('dataTitle')}</h2>
      <p>{t('data')}</p>
      <h2>{t('consentTitle')}</h2>
      <p>{t('consent')}</p>
    </section>
  );
}
