import { parseOrderFilters, orderFilterFields, adminOrdersReturn } from './order-filters';
it('keeps filters while translating inclusive local days to an exclusive API boundary', () => {
  const filters = parseOrderFilters(
    new URLSearchParams('q=tea&customerType=GUEST&page=2&from=2026-11-01&to=2026-11-03'),
  )!;
  expect(filters).toMatchObject({ q: 'tea', customerType: 'GUEST', page: 2 });
  expect(new Date(filters.from!).getDate()).toBe(1);
  expect(new Date(filters.to!).getDate()).toBe(4);
});
it('rejects invalid dates, ranges, pages and enums instead of silently changing the query', () => {
  for (const value of [
    'from=2026-02-30',
    'from=2026-11-05&to=2026-11-01',
    'page=0',
    'page=1.2',
    'status=INVENTED',
  ])
    expect(parseOrderFilters(new URLSearchParams(value))).toBeNull();
  expect(
    orderFilterFields.safeParse({
      q: 'x'.repeat(101),
      status: '',
      paymentMethod: '',
      customerType: '',
      from: '',
      to: '',
    }).success,
  ).toBe(false);
});

it('restores the filtered list while refusing an external return destination', () => {
  expect(adminOrdersReturn('/admin/orders?q=tea&page=2')).toBe('/admin/orders?q=tea&page=2');
  for (const value of [
    '//example.com',
    'https://example.com',
    '/admin/orders/../../evil',
    '/admin/orders?page=0',
  ])
    expect(adminOrdersReturn(value)).toBe('/admin/orders');
});
