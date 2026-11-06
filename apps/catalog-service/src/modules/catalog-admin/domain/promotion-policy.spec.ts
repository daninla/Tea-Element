import type { PromotionInput } from '@tea/contracts';
import { validatePromotion } from './promotion-policy';
import { effectivePrice } from '../../catalog/domain/pricing';
const sample = (): PromotionInput => ({
  name: 'Sale',
  type: 'PERCENT',
  value: 15,
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: '2027-01-01T00:00:00.000Z',
  isActive: true,
  targets: [{ kind: 'PRODUCT', id: 'product' }],
});
it.each([0, 101, 1.5, 2147483648])('rejects invalid percent %s', (value) => {
  expect(() => validatePromotion({ ...sample(), value })).toThrow();
});
it('accepts integer fixed kopecks and rejects empty or duplicate targets', () => {
  expect(() => validatePromotion({ ...sample(), type: 'FIXED', value: 12345 })).not.toThrow();
  expect(() => validatePromotion({ ...sample(), targets: [] })).toThrow();
  expect(() =>
    validatePromotion({ ...sample(), targets: [...sample().targets, ...sample().targets] }),
  ).toThrow();
});
it('rejects invalid or inverted periods', () => {
  for (const endsAt of ['invalid', '2025-01-01T00:00:00Z', sample().startsAt])
    expect(() => validatePromotion({ ...sample(), endsAt })).toThrow();
});
it('applies the best discount only during the half-open period and never below zero', () => {
  const x = sample(),
    percent = { id: 'test', ...x, startsAt: new Date(x.startsAt), endsAt: new Date(x.endsAt) },
    fixed = { ...percent, type: 'FIXED' as const, value: 2001 };
  const now = new Date(x.startsAt);
  expect(effectivePrice(10001, [percent, fixed], now)).toBe(8000);
  expect(effectivePrice(10001, [percent, fixed], new Date(x.endsAt))).toBe(10001);
  expect(effectivePrice(10001, [{ ...fixed, value: 20000 }], now)).toBe(0);
  expect(effectivePrice(10001, [{ ...fixed, isActive: false }], now)).toBe(10001);
});
