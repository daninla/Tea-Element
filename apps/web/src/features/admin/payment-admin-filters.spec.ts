import { parsePaymentFilters, paymentReturn, reconciliationFields } from './payment-admin-filters';
import { safeAccountNext } from '../account/account-schema';
it('validates payment filters and uses an exclusive end of the selected local day', () => {
  const p = parsePaymentFilters(
    new URLSearchParams('q=TE-%25_&status=PENDING&refundOnly=true&from=2026-11-06&to=2026-11-06'),
  );
  expect(p).toMatchObject({
    kind: 'LIST',
    page: 1,
    q: 'TE-%_',
    status: 'PENDING',
    refundOnly: true,
  });
  expect(new Date(p!.to!).getTime()).toBe(new Date('2026-11-07T00:00:00').getTime());
  for (const x of [
    'page=0',
    'status=OTHER',
    'refundOnly=yes',
    'from=2026-11-07&to=2026-11-06',
    'page=1&page=2',
    'actorId=x',
  ])
    expect(parsePaymentFilters(new URLSearchParams(x))).toBeNull();
});
it('keeps return navigation internal and requires explicit reconciliation confirmation', () => {
  expect(safeAccountNext('/admin/payments/events')).toBe('/admin/payments/events');
  expect(paymentReturn('//evil.test')).toBe('/admin/payments');
  expect(paymentReturn('/admin/payments?status=FAILED')).toBe('/admin/payments?status=FAILED');
  expect(reconciliationFields.safeParse({ reason: 'Check', confirmed: false }).success).toBe(false);
  expect(reconciliationFields.parse({ reason: ' Check ', confirmed: true })).toEqual({
    reason: 'Check',
    confirmed: true,
  });
});
