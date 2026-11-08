import { winBackDue } from './win-back-rule';
const now = new Date('2026-11-08T00:00:00Z'),
  day = 86400000;
test('uses a fixed thirty-day boundary', () => {
  expect(winBackDue({ last: new Date(now.getTime() - 30 * day + 1), now })).toBe(false);
  expect(winBackDue({ last: new Date(now.getTime() - 30 * day), now })).toBe(true);
});
test('requires a completed past purchase', () => {
  expect(winBackDue({ last: null, now })).toBe(false);
  expect(winBackDue({ last: new Date(now.getTime() + day), now })).toBe(false);
});
