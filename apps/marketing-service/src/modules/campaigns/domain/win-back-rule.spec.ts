import { winBackDue } from './win-back-rule';
const day = 86400000,
  now = new Date('2026-11-08T12:00:00Z');
it('requires a purchase and a full minimum thirty-day interval', () => {
  expect(winBackDue({ count: 0, first: now, last: now, now })).toBe(false);
  expect(
    winBackDue({ count: 1, first: now, last: new Date(now.getTime() - 30 * day + 1), now }),
  ).toBe(false);
  expect(winBackDue({ count: 1, first: now, last: new Date(now.getTime() - 30 * day), now })).toBe(
    true,
  );
  expect(winBackDue({ count: 1, first: now, last: new Date(now.getTime() + day), now })).toBe(
    false,
  );
});
it('uses one and a half of the average purchase interval rounded upward', () => {
  const last = new Date(now.getTime() - 60 * day),
    first = new Date(last.getTime() - 80 * day);
  expect(winBackDue({ count: 3, first, last, now })).toBe(true);
  expect(winBackDue({ count: 3, first: new Date(first.getTime() - day), last, now })).toBe(false);
});
