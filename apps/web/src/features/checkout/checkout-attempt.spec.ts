import { checkoutAttempt } from './checkout-attempt';
const fingerprint = 'a'.repeat(64),
  key = '00000000-0000-4000-8000-000000000001';
describe('checkout retries', () => {
  it('retains a matching idempotency key after an uncertain response', () => {
    const create = jest.fn();
    expect(checkoutAttempt(fingerprint, JSON.stringify({ key, fingerprint }), create)).toEqual({
      key,
      fingerprint,
    });
    expect(create).not.toHaveBeenCalled();
  });
  it('gives a changed order a new attempt', () => {
    expect(
      checkoutAttempt('b'.repeat(64), JSON.stringify({ key, fingerprint }), () => 'new').key,
    ).toBe('new');
  });
  it.each([null, 'broken', '{}', JSON.stringify({ key: 'bad', fingerprint })])(
    'recovers from invalid cached metadata',
    (stored) => {
      expect(checkoutAttempt(fingerprint, stored, () => key)).toEqual({ key, fingerprint });
    },
  );
});
