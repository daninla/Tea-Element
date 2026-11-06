import { promotionFields, localDateTime } from './promotion-schema';
const sample = {
  name: 'Sale',
  type: 'FIXED',
  value: '12,34',
  startsAt: '2026-11-06T10:00',
  endsAt: '2026-11-07T10:00',
  isActive: true,
};
it('converts fixed currency to kopecks and local dates to UTC without changing the displayed time', () => {
  const x = promotionFields.parse(sample);
  expect(x.value).toBe(1234);
  expect(localDateTime(x.startsAt)).toBe(sample.startsAt);
});
it('rejects invalid discounts and time ranges', () => {
  for (const x of [
    { ...sample, value: '1.001' },
    { ...sample, type: 'PERCENT', value: '101' },
    { ...sample, type: 'PERCENT', value: '1.5' },
    { ...sample, endsAt: sample.startsAt },
    { ...sample, startsAt: '2026-02-30T10:00' },
  ])
    expect(promotionFields.safeParse(x).success).toBe(false);
  expect(promotionFields.parse({ ...sample, type: 'PERCENT', value: '100' }).value).toBe(100);
});
