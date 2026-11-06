import { adminOrdersReturn } from './order-filters';
import { parseCustomerFilters, customerReturn, customerDetailReturn } from './customer-filters';
import { safeAccountNext } from '../account/account-schema';
it('validates bounded and literal filters without duplicate or unknown fields', () => {
  expect(parseCustomerFilters(new URLSearchParams('kind=GUEST&q=%25_&page=2'))).toEqual({
    kind: 'GUEST',
    q: '%_',
    page: 2,
  });
  for (const x of ['page=0', 'kind=OTHER', 'page=1&page=2', 'userId=other', 'q=' + 'x'.repeat(101)])
    expect(parseCustomerFilters(new URLSearchParams(x))).toBeNull();
});
it('keeps customer navigation internal and preserves an encoded guest return after login', () => {
  for (const x of [
    'https://evil.test',
    '//evil.test',
    '/admin/customers/../orders',
    '/admin/customers?role=ADMIN',
  ])
    expect(customerReturn(x)).toBe('/admin/customers');
  expect(customerReturn('/admin/customers?kind=GUEST&page=2')).toBe(
    '/admin/customers?kind=GUEST&page=2',
  );
  expect(safeAccountNext('/admin/customers/guest?email=x%40example.test')).toBe(
    '/admin/customers/guest?email=x%40example.test',
  );
  expect(safeAccountNext('//evil.test')).toBe('/account');
  expect(safeAccountNext('/admin/customers/guest?email=x@example.test')).toBe(
    '/admin/customers/guest?email=x@example.test',
  );
  const profile =
    '/admin/customers/guest?email=x%40example.test&page=2&returnTo=' +
    encodeURIComponent('/admin/customers?kind=GUEST');
  expect(customerDetailReturn(profile)).toBe(profile);
  expect(adminOrdersReturn(profile)).toBe(profile);
  for (const value of [
    '/admin/customers/guest?email=invalid',
    '/admin/customers/guest?email=x%40example.test&returnTo=https%3A%2F%2Fevil.test',
    '//evil.test',
  ])
    expect(customerDetailReturn(value)).toBeNull();
});
