import { productHref, categoryHref } from './catalog-links';
describe('catalog sections and units', () => {
  it('links tea portions with their gram weight', () =>
    expect(productHref('tea', 50)).toBe('/product/tea?weight=50'));
  it('never appends weight=null for equipment', () =>
    expect(productHref('gaiwan', null)).toBe('/product/gaiwan'));
  it('keeps equipment categories in the equipment section', () =>
    expect(categoryHref({ slug: 'accessories', section: 'EQUIPMENT' })).toBe(
      '/teaware?category=accessories',
    ));
  it('preserves existing tea category links', () =>
    expect(categoryHref({ slug: 'puer' })).toBe('/catalog/puer'));
});
