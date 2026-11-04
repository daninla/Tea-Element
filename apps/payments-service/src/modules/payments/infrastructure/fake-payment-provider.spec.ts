import { FakePaymentProvider } from './fake-payment-provider';
const input = {
  paymentId: 'attempt_1',
  orderNumber: 'TE-1',
  amount: 13950,
  currency: 'UAH' as const,
  expiresAt: '2099-01-01T00:00:00Z',
  returnUrl: 'http://localhost:3000/order/result',
};
describe('offline payment simulator', () => {
  let provider: FakePaymentProvider;
  beforeEach(() => {
    provider = new FakePaymentProvider('a'.repeat(32));
  });
  it('creates/replays one pending checkout without network access', async () => {
    expect(await provider.createCheckout(input)).toEqual({
      provider: 'FAKE',
      paymentId: input.paymentId,
    });
    expect(await provider.createCheckout(input)).toEqual({
      provider: 'FAKE',
      paymentId: input.paymentId,
    });
    expect((await provider.getStatus(input)).status).toBe('PENDING');
    await expect(provider.createCheckout({ ...input, amount: 1 })).rejects.toThrow(
      'PAYMENT_MISMATCH',
    );
  });
  it('produces a signed success and duplicate callbacks parse identically', async () => {
    await provider.createCheckout(input);
    const callback = provider.settle(input.paymentId, 'SUCCEEDED');
    expect(provider.verifyWebhook(callback)).toBe(true);
    expect(provider.parseWebhook(callback, input).status).toBe('SUCCEEDED');
    expect(provider.parseWebhook(callback, input)).toEqual(provider.parseWebhook(callback, input));
    expect(() => provider.parseWebhook(callback, { ...input, amount: 1 })).toThrow(
      'PAYMENT_MISMATCH',
    );
  });
  it('supports a lost callback followed by status reconciliation', async () => {
    await provider.createCheckout(input);
    provider.settle(input.paymentId, 'SUCCEEDED');
    expect((await provider.getStatus(input)).status).toBe('SUCCEEDED');
    const snapshot = await provider.getStatus(input);
    snapshot.status = 'FAILED';
    expect((await provider.getStatus(input)).status).toBe('SUCCEEDED');
  });
  it('supports full refund replay and refuses to refund unpaid/failed payments', async () => {
    await provider.createCheckout(input);
    await expect(provider.refund(input)).rejects.toThrow('INVALID_TRANSITION');
    provider.settle(input.paymentId, 'SUCCEEDED');
    expect(await provider.refund(input)).toEqual(await provider.refund(input));
    expect((await provider.getStatus(input)).status).toBe('REFUNDED');
    expect(() => provider.settle(input.paymentId, 'FAILED')).toThrow('INVALID_TRANSITION');
  });
  it('supports refusal and prevents changing a terminal result', async () => {
    await provider.createCheckout(input);
    provider.settle(input.paymentId, 'FAILED');
    expect((await provider.getStatus(input)).status).toBe('FAILED');
    expect(() => provider.settle(input.paymentId, 'SUCCEEDED')).toThrow('INVALID_TRANSITION');
  });
  it('rejects tampering and signatures from another instance', async () => {
    await provider.createCheckout(input);
    const callback = provider.settle(input.paymentId, 'SUCCEEDED');
    expect(provider.verifyWebhook({ ...callback, data: callback.data + 'A' })).toBe(false);
    expect(() => provider.parseWebhook({ ...callback, signature: '' }, input)).toThrow(
      'INVALID_SIGNATURE',
    );
    expect(new FakePaymentProvider('b'.repeat(32)).verifyWebhook(callback)).toBe(false);
  });
  it('reports missing payments and requires a signing secret', async () => {
    await expect(provider.getStatus(input)).rejects.toThrow('PAYMENT_NOT_FOUND');
    expect(() => provider.settle(input.paymentId, 'SUCCEEDED')).toThrow('PAYMENT_NOT_FOUND');
    expect(() => new FakePaymentProvider('short')).toThrow('INVALID_INPUT');
  });
});
