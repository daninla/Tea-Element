import { readEnvironment } from './environment';
describe('environment', () => {
  it('rejects invalid ports instead of silently booting', () => {
    expect(() => readEnvironment({ PORT: 'not-a-port' })).toThrow();
    expect(() => readEnvironment({ PORT: '65536' })).toThrow();
  });
});

describe('payment provider configuration', () => {
  const sandbox = {
    PAYMENT_PROVIDER: 'liqpay',
    LIQPAY_PUBLIC_KEY: 'sandbox_public',
    LIQPAY_PRIVATE_KEY: 'sandbox_private',
    CORS_ORIGIN: 'https://shop.example',
    PAYMENT_CALLBACK_URL: 'https://api.example/api/v1/payments/webhook/liqpay',
  };
  it('defaults to offline fake provider without external credentials', () => {
    expect(readEnvironment({}).PAYMENT_PROVIDER).toBe('fake');
  });
  it('rejects fake mode in production and unknown providers', () => {
    expect(() => readEnvironment({ NODE_ENV: 'production' })).toThrow();
    expect(() => readEnvironment({ PAYMENT_PROVIDER: 'unknown' })).toThrow();
  });
  it('requires both sandbox keys and HTTPS endpoints for LiqPay', () => {
    expect(readEnvironment(sandbox).PAYMENT_PROVIDER).toBe('liqpay');
    for (const override of [
      { LIQPAY_PUBLIC_KEY: '' },
      { LIQPAY_PRIVATE_KEY: 'live_key' },
      { CORS_ORIGIN: 'http://localhost:3000' },
      { PAYMENT_CALLBACK_URL: undefined },
    ])
      expect(() => readEnvironment({ ...sandbox, ...override })).toThrow();
  });
});
