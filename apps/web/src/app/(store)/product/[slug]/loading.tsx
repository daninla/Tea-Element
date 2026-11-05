import { getTranslations } from 'next-intl/server';
export default async function Loading() {
  const t = await getTranslations('common');
  return (
    <section className="container section" aria-busy="true" aria-label={t('loading')}>
      <div className="product-detail">
        <div className="skeleton" style={{ aspectRatio: '1' }} />
        <div>
          <div className="skeleton" style={{ height: 65, marginBottom: 25 }} />
          <div className="skeleton" style={{ height: 180 }} />
        </div>
      </div>
    </section>
  );
}
