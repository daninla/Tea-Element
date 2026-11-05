import {
  purchaseFields,
  adjustmentFields,
  parseInventoryFilters,
  inventoryReturn,
} from './inventory-schema';
it('converts hryvnia costs exactly and requires quantity, date and explicit confirmation', () => {
  const input = {
    quantity: '25',
    price: '123,45',
    supplier: 'Test',
    date: '2020-01-01',
    note: 'Test receipt',
    confirmed: true,
  };
  const parsed = purchaseFields.parse(input);
  expect(parsed.price).toBe(12345);
  for (const change of [
    { price: '1.234' },
    { quantity: '1.5' },
    { confirmed: false },
    { date: '2020-02-30' },
  ])
    expect(purchaseFields.safeParse({ ...input, ...change }).success).toBe(false);
  expect(
    adjustmentFields.safeParse({
      quantity: '0',
      operation: 'WRITE_OFF',
      reason: 'test',
      confirmed: true,
    }).success,
  ).toBe(false);
});
it('preserves bounded URL filters and rejects external return destinations', () => {
  expect(
    parseInventoryFilters(new URLSearchParams('section=EQUIPMENT&lowStock=true&page=2')),
  ).toMatchObject({ page: 2, lowStock: true, section: 'EQUIPMENT' });
  for (const query of ['page=0', 'lowStock=yes', 'section=INVALID'])
    expect(parseInventoryFilters(new URLSearchParams(query))).toBeNull();
  expect(inventoryReturn('/admin/inventory?q=tea')).toBe('/admin/inventory?q=tea');
  expect(inventoryReturn('//example.com')).toBe('/admin/inventory');
});
