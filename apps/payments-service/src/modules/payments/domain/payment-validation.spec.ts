import { decimalToKopecks, kopecksToDecimal, validateCheckout } from './payment-validation';
const valid = {
  paymentId: 'attempt_1',
  orderNumber: 'TE-1',
  amount: 13950,
  currency: 'UAH' as const,
  expiresAt: '2099-01-01T00:00:00Z',
  returnUrl: 'https://shop.example/order/result',
};
describe('payment money boundaries', () => {
  it.each([
    [1, '0.01'],
    [13950, '139.50'],
    [2147483647, '21474836.47'],
  ] as const)('round-trips %i kopecks exactly', (amount, decimal) => {
    expect(kopecksToDecimal(amount)).toBe(decimal);
    expect(decimalToKopecks(decimal)).toBe(amount);
  });
  it.each(['1.001', '1e2', '-1', 'NaN', 'Infinity', ' 1.00', '1,25', '0', '21474836.48', null, {}])(
    'rejects malformed or unsafe amounts %p',
    (input) => {
      expect(() => decimalToKopecks(input)).toThrow('INVALID_RESPONSE');
    },
  );
  it('accepts JSON numeric provider amounts without floating-point multiplication', () => {
    expect(decimalToKopecks(139.5)).toBe(13950);
    expect(decimalToKopecks(0.29)).toBe(29);
  });
  it.each([0, -1, 1.5, Number.NaN, 2147483648])('rejects invalid checkout amount %p', (amount) => {
    expect(() => validateCheckout({ ...valid, amount })).toThrow('INVALID_INPUT');
  });
  it('rejects expired intents and invalid merchant identifiers', () => {
    expect(() => validateCheckout({ ...valid, expiresAt: '2000-01-01T00:00:00Z' })).toThrow(
      'INVALID_INPUT',
    );
    expect(() => validateCheckout({ ...valid, paymentId: 'https://other.example' })).toThrow(
      'INVALID_INPUT',
    );
  });
});
