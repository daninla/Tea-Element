import { createHash } from 'node:crypto';
import { LiqPayProvider } from './liqpay-provider';
const options = {
  publicKey: 'sandbox_public_test',
  privateKey: 'sandbox_private_test',
  callbackUrl: 'https://api.example/api/v1/payments/webhook/liqpay',
  storefrontOrigin: 'https://shop.example',
};
const input = {
  paymentId: 'attempt_1',
  orderNumber: 'TE-1',
  amount: 13950,
  currency: 'UAH' as const,
  expiresAt: '2099-01-01T00:00:00Z',
  returnUrl: 'https://shop.example/order/result',
};
const success = {
  public_key: options.publicKey,
  order_id: input.paymentId,
  amount: '139.50',
  currency: 'UAH',
  status: 'success',
  payment_id: 123,
  action: 'pay',
};
function webhook(payload: unknown, algorithm = 'sha3-256') {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  return {
    data,
    signature: createHash(algorithm)
      .update(options.privateKey + data + options.privateKey)
      .digest('base64'),
  };
}
function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
describe('LiqPay sandbox API v7 adapter', () => {
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  let provider: LiqPayProvider;
  beforeEach(() => {
    transport.mockReset();
    provider = new LiqPayProvider(options, transport);
  });
  it('creates a signed hosted POST form with exact decimal amount, attempt ID and UTC expiry', async () => {
    const checkout = await provider.createCheckout(input);
    expect(checkout.provider).toBe('LIQPAY');
    if (checkout.provider !== 'LIQPAY') throw new Error('Wrong provider');
    expect(checkout.actionUrl).toBe('https://www.liqpay.ua/api/3/checkout');
    const payload = JSON.parse(Buffer.from(checkout.fields.data, 'base64').toString()) as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      version: 7,
      action: 'pay',
      order_id: 'attempt_1',
      amount: '139.50',
      currency: 'UAH',
      public_key: options.publicKey,
      server_url: options.callbackUrl,
      result_url: input.returnUrl,
      expired_date: '2099-01-01 00:00:00',
    });
    expect(payload).not.toHaveProperty('private_key');
    expect(payload).not.toHaveProperty('sandbox');
    expect(provider.verifyWebhook(checkout.fields)).toBe(true);
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects forged, truncated, malformed and legacy SHA1 signatures before parsing', () => {
    const signed = webhook(success);
    expect(provider.verifyWebhook(signed)).toBe(true);
    for (const callback of [
      { ...signed, data: signed.data + 'x' },
      { ...signed, signature: '' },
      { ...signed, signature: signed.signature + '!' },
      webhook(success, 'sha1'),
      { data: 'a'.repeat(65537), signature: 'x' },
    ]) {
      expect(() => provider.parseWebhook(callback, input)).toThrow('INVALID_SIGNATURE');
    }
  });
  it.each([
    { amount: '139.49' },
    { currency: 'USD' },
    { order_id: 'other_attempt' },
    { public_key: 'sandbox_other' },
  ])('rejects validly signed mismatches %p', (override) => {
    expect(() => provider.parseWebhook(webhook({ ...success, ...override }), input)).toThrow(
      'PAYMENT_MISMATCH',
    );
  });
  it.each([
    ['success', 'SUCCEEDED'],
    ['failure', 'FAILED'],
    ['error', 'FAILED'],
    ['reversed', 'REFUNDED'],
    ['processing', 'PENDING'],
    ['wait_accept', 'PENDING'],
    ['3ds_verify', 'PENDING'],
  ] as const)('normalizes %s to %s', (status, expected) => {
    expect(provider.parseWebhook(webhook({ ...success, status }), input).status).toBe(expected);
  });
  it.each([
    { status: 'future_unknown' },
    { amount: '139.5001' },
    { payment_id: undefined },
    { action: 'hold' },
  ])('rejects unsupported or incomplete responses %p', (override) => {
    expect(() => provider.parseWebhook(webhook({ ...success, ...override }), input)).toThrow(
      'INVALID_RESPONSE',
    );
  });
  it('strips card tokens/PII from normalized observations', () => {
    expect(
      provider.parseWebhook(
        webhook({ ...success, card_token: 'do-not-retain', sender_phone: 'private' }),
        input,
      ),
    ).toEqual({
      paymentId: 'attempt_1',
      amount: 13950,
      currency: 'UAH',
      status: 'SUCCEEDED',
      providerPaymentId: '123',
    });
  });
  it('uses signed server requests for reconciliation and checks the returned payment', async () => {
    transport.mockResolvedValueOnce(response(success));
    expect((await provider.getStatus(input)).status).toBe('SUCCEEDED');
    const [url, request] = transport.mock.calls[0]!;
    expect(url).toBe('https://www.liqpay.ua/api/request');
    expect(request).toMatchObject({ method: 'POST', redirect: 'error' });
    const fields = request!.body as URLSearchParams;
    expect(
      provider.verifyWebhook({ data: fields.get('data')!, signature: fields.get('signature')! }),
    ).toBe(true);
    expect(JSON.parse(Buffer.from(fields.get('data')!, 'base64').toString())).toMatchObject({
      version: 7,
      action: 'status',
      order_id: input.paymentId,
    });
    transport.mockResolvedValueOnce(response({ ...success, amount: 1 }));
    await expect(provider.getStatus(input)).rejects.toThrow('PAYMENT_MISMATCH');
  });
  it.each([
    () => Promise.reject(new Error('private-key/raw payload must not escape')),
    () => Promise.resolve(response({}, 503)),
    () => Promise.resolve(new Response('invalid JSON')),
  ])('normalizes transport errors without leaking details', async (result) => {
    transport.mockImplementationOnce(result);
    await expect(provider.getStatus(input)).rejects.toThrow(/^PROVIDER_UNAVAILABLE$/);
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('refunds the full amount and confirms only a completed refund', async () => {
    transport
      .mockResolvedValueOnce(response(success))
      .mockResolvedValueOnce(
        response({ result: 'ok', status: 'reversed', payment_id: 123, wait_amount: false }),
      );
    expect(await provider.refund(input)).toEqual({ status: 'REFUNDED', providerPaymentId: '123' });
    const fields = transport.mock.calls[1]![1]!.body as URLSearchParams;
    expect(JSON.parse(Buffer.from(fields.get('data')!, 'base64').toString())).toMatchObject({
      action: 'refund',
      amount: '139.50',
      order_id: 'attempt_1',
    });
  });
  it('keeps a refund pending when provider awaits funds and skips an already refunded payment', async () => {
    transport
      .mockResolvedValueOnce(response(success))
      .mockResolvedValueOnce(
        response({ result: 'ok', status: 'reversed', payment_id: 123, wait_amount: 'true' }),
      );
    expect((await provider.refund(input)).status).toBe('PENDING');
    transport.mockResolvedValueOnce(response({ ...success, status: 'reversed' }));
    expect((await provider.refund(input)).status).toBe('REFUNDED');
    expect(transport).toHaveBeenCalledTimes(3);
  });
  it('refuses refunds of unpaid payments and mismatched provider refund IDs', async () => {
    transport.mockResolvedValueOnce(response({ ...success, status: 'processing' }));
    await expect(provider.refund(input)).rejects.toThrow('INVALID_TRANSITION');
    transport
      .mockResolvedValueOnce(response(success))
      .mockResolvedValueOnce(response({ result: 'ok', status: 'reversed', payment_id: 456 }));
    await expect(provider.refund(input)).rejects.toThrow('PAYMENT_MISMATCH');
  });
  it('rejects live keys, insecure callbacks and external return URLs', async () => {
    expect(() => new LiqPayProvider({ ...options, publicKey: 'live_key' }, transport)).toThrow(
      'INVALID_INPUT',
    );
    expect(
      () => new LiqPayProvider({ ...options, callbackUrl: 'http://api.example' }, transport),
    ).toThrow('INVALID_INPUT');
    await expect(
      provider.createCheckout({ ...input, returnUrl: 'https://evil.example' }),
    ).rejects.toThrow('INVALID_INPUT');
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('pending provider refund protection', () => {
  it('does not mark a refund funded by future payments completed or submit it twice', async () => {
    const transport = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(response({ ...success, status: 'reversed', wait_amount: true }));
    const provider = new LiqPayProvider(options, transport);
    expect(
      provider.parseWebhook(webhook({ ...success, status: 'reversed', wait_amount: 'true' }), input)
        .status,
    ).toBe('REFUND_PENDING');
    expect((await provider.refund(input)).status).toBe('PENDING');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('rejects signed malformed JSON and non-canonical base64 without leaking it', () => {
    const provider = new LiqPayProvider(options);
    for (const data of [Buffer.from('{"private":"unclosed').toString('base64'), 'not base64']) {
      const signature = createHash('sha3-256')
        .update(options.privateKey + data + options.privateKey)
        .digest('base64');
      expect(() => provider.parseWebhook({ data, signature }, input)).toThrow(/^INVALID_RESPONSE$/);
    }
  });
});

describe('bounded provider responses', () => {
  it('rejects an oversized response without returning provider data', async () => {
    const transport = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(new Response('x'.repeat(65537)));
    const provider = new LiqPayProvider(options, transport);
    await expect(provider.getStatus(input)).rejects.toThrow(/^PROVIDER_UNAVAILABLE$/);
  });
});

describe('partial and reserved refund observations', () => {
  it('preserves a partial refund and refuses a full-amount refund on top of it', async () => {
    const partial = { ...success, status: 'reversed', refund_amount: '10.00' };
    const transport = jest
      .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
      .mockResolvedValue(response(partial));
    const provider = new LiqPayProvider(options, transport);
    expect(provider.parseWebhook(webhook(partial), input)).toMatchObject({
      status: 'PARTIALLY_REFUNDED',
      refundedAmount: 1000,
    });
    await expect(provider.refund(input)).rejects.toThrow('INVALID_TRANSITION');
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it('keeps wait_reserve pending and validates refunded amount boundaries', () => {
    const provider = new LiqPayProvider(options);
    expect(
      provider.parseWebhook(webhook({ ...success, status: 'wait_reserve' }), input).status,
    ).toBe('REFUND_PENDING');
    expect(provider.parseWebhook(webhook({ ...success, refund_amount: 0 }), input).status).toBe(
      'SUCCEEDED',
    );
    expect(
      provider.parseWebhook(webhook({ ...success, refund_amount: '139.50' }), input).status,
    ).toBe('REFUNDED');
    expect(() =>
      provider.parseWebhook(webhook({ ...success, status: 'reversed', refund_amount: 0 }), input),
    ).toThrow('INVALID_RESPONSE');
    expect(() =>
      provider.parseWebhook(webhook({ ...success, refund_amount: '139.51' }), input),
    ).toThrow('INVALID_RESPONSE');
  });
});
