import { paymentTransition } from './payment-policy';
describe('payment transitions', () => {
  it('does not revive terminal state with pending or failure callbacks', () => {
    for (const current of ['SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED', 'EXPIRED']) {
      expect(paymentTransition(current, 'PENDING')).toBe(current);
      expect(paymentTransition(current, 'FAILED')).toBe(current);
    }
  });
  it('records late money after failure/expiry so cancellation can compensate it', () => {
    expect(paymentTransition('EXPIRED', 'SUCCEEDED')).toBe('SUCCEEDED');
    expect(paymentTransition('FAILED', 'SUCCEEDED')).toBe('SUCCEEDED');
  });
  it('never regresses a full or partial refund after a delayed success', () => {
    expect(paymentTransition('REFUNDED', 'SUCCEEDED')).toBe('REFUNDED');
    expect(paymentTransition('PARTIALLY_REFUNDED', 'SUCCEEDED')).toBe('PARTIALLY_REFUNDED');
    expect(paymentTransition('SUCCEEDED', 'REFUND_PENDING')).toBe('SUCCEEDED');
  });
});
