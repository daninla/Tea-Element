import { catalogHref, parseCatalogQuery } from './catalog-query';
describe('storefront catalog URLs', () => {
  it('converts user-entered hryvnias exactly into integer kopecks', () => {
    expect(
      parseCatalogQuery({ minPrice: '1,01', maxPrice: '100.99', onSale: 'false', q: ' чай ' }).data,
    ).toMatchObject({ minPrice: 101, maxPrice: 10099, onSale: false, q: 'чай' });
  });
  it('accepts zero, ignores empty controls and lets the category route take precedence', () => {
    expect(
      parseCatalogQuery({ category: 'red', minPrice: '0', origin: '', q: '' }, 'oolong').data,
    ).toMatchObject({ category: 'oolong', minPrice: 0, origin: undefined, q: undefined });
  });
  it.each([
    { page: '0' },
    { page: ['1', '2'] },
    { minPrice: '-1' },
    { maxPrice: '1.001' },
    { minPrice: '21474836.48' },
    { minPrice: '20', maxPrice: '10' },
    { onSale: 'yes' },
    { q: ['a', 'b'] },
    { sort: 'unknown' },
    { unknown: '1' },
  ])('rejects invalid or ambiguous URL %j', (raw) => {
    expect(parseCatalogQuery(raw).success).toBe(false);
  });
  it('preserves category, filters and literal search during pagination', () => {
    const href = catalogHref(
      { category: 'oolong', minPrice: 10001, q: '茶 & чай', onSale: true, sort: 'price_asc' },
      2,
    );
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/catalog/oolong');
    expect(url.searchParams.get('minPrice')).toBe('100.01');
    expect(url.searchParams.get('q')).toBe('茶 & чай');
    expect(url.searchParams.get('page')).toBe('2');
    expect(parseCatalogQuery(Object.fromEntries(url.searchParams), 'oolong').data?.minPrice).toBe(
      10001,
    );
  });
});
