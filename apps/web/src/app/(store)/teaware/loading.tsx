import { getTranslations } from 'next-intl/server';
export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <section className="container section" aria-busy="true" aria-label={t('loading')}>
      <div className="skeleton" style={{ width: '55%', height: 55, marginBottom: 45 }} />
      <div className="product-grid">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="skeleton" style={{ aspectRatio: '1' }} />
            <div className="skeleton" style={{ height: 25, marginTop: 20 }} />
          </div>
        ))}
      </div>
    </section>
  );
}
