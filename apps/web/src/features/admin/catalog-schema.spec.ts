import { catalogPrice, parseCatalogFilters, categoryFields } from './catalog-schema';
it('parses prices into exact kopecks and rejects sub-kopeck, zero or overflow values', () => {
  expect(catalogPrice.parse('125,09')).toBe(12509);
  expect(catalogPrice.parse('0.01')).toBe(1);
  for (const x of ['0', '1.001', '-1', 'NaN', '21474836.48'])
    expect(catalogPrice.safeParse(x).success).toBe(false);
});
it('rejects malformed filters and category URLs', () => {
  expect(parseCatalogFilters(new URLSearchParams('page=2&active=false'))).toMatchObject({
    page: 2,
    active: 'false',
  });
  for (const x of ['page=0', 'active=yes', 'section=OTHER', 'page=1.2'])
    expect(parseCatalogFilters(new URLSearchParams(x))).toBeNull();
  expect(
    categoryFields.safeParse({
      slug: '../x',
      name: 'x',
      description: '',
      section: 'TEA',
      sortOrder: 0,
      isActive: true,
    }).success,
  ).toBe(false);
});
