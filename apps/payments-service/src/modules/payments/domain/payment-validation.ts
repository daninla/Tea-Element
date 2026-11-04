import {
  PaymentProviderError,
  type PaymentIdentity,
  type CheckoutIntent,
} from './payment-provider';
export const MAX_PAYMENT_AMOUNT = 2_147_483_647;
export function validateIdentity(input: PaymentIdentity) {
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(input.paymentId) ||
    input.currency !== 'UAH' ||
    !Number.isSafeInteger(input.amount) ||
    input.amount < 1 ||
    input.amount > MAX_PAYMENT_AMOUNT
  )
    throw new PaymentProviderError('INVALID_INPUT');
}
export function validateCheckout(input: CheckoutIntent, now = Date.now()) {
  validateIdentity(input);
  if (
    !/^[a-zA-Z0-9_-]{1,100}$/.test(input.orderNumber) ||
    !Number.isFinite(Date.parse(input.expiresAt)) ||
    Date.parse(input.expiresAt) <= now
  )
    throw new PaymentProviderError('INVALID_INPUT');
}
/** Decimal boundary conversion; never round an invalid provider amount into a valid payment. */
export function decimalToKopecks(input: unknown, minimum: 0 | 1 = 1): number {
  const text = typeof input === 'number' || typeof input === 'string' ? String(input) : '';
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(text)) throw new PaymentProviderError('INVALID_RESPONSE');
  const [whole, fraction = ''] = text.split('.');
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(value) || value < minimum || value > MAX_PAYMENT_AMOUNT)
    throw new PaymentProviderError('INVALID_RESPONSE');
  return value;
}
export function kopecksToDecimal(amount: number): string {
  validateIdentity({ paymentId: 'amount', amount, currency: 'UAH' });
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`;
}
export function matchPayment(actual: PaymentIdentity, expected: PaymentIdentity) {
  validateIdentity(expected);
  if (
    actual.paymentId !== expected.paymentId ||
    actual.amount !== expected.amount ||
    actual.currency !== expected.currency
  )
    throw new PaymentProviderError('PAYMENT_MISMATCH');
}
