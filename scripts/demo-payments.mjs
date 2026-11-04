import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  FakePaymentProvider,
} = require('../apps/payments-service/dist/modules/payments/infrastructure/fake-payment-provider.js');
const provider = new FakePaymentProvider(randomBytes(32).toString('hex'));
const input = {
  paymentId: 'demo_attempt_1',
  orderNumber: 'TE-DEMO',
  amount: 13950,
  currency: 'UAH',
  expiresAt: new Date(Date.now() + 1800000).toISOString(),
  returnUrl: 'http://localhost:3000/order/demo/result',
};
await provider.createCheckout(input);
assert.equal((await provider.getStatus(input)).status, 'PENDING');
console.log('Offline checkout: PENDING, 13950 kopecks UAH');
const callback = provider.settle(input.paymentId, 'SUCCEEDED');
assert.equal(provider.parseWebhook(callback, input).status, 'SUCCEEDED');
assert.deepEqual(provider.parseWebhook(callback, input), provider.parseWebhook(callback, input));
assert.throws(() => provider.parseWebhook({ ...callback, signature: 'invalid' }, input));
assert.throws(() => provider.parseWebhook(callback, { ...input, amount: 1 }));
console.log('Signed success: SUCCEEDED; duplicates stable; tampering and amount mismatch rejected');
const lost = { ...input, paymentId: 'demo_attempt_lost_callback' };
await provider.createCheckout(lost);
provider.settle(lost.paymentId, 'SUCCEEDED');
assert.equal((await provider.getStatus(lost)).status, 'SUCCEEDED');
console.log('Lost callback: provider status recovers SUCCEEDED');
assert.equal((await provider.refund(input)).status, 'REFUNDED');
assert.equal((await provider.refund(input)).status, 'REFUNDED');
console.log('Full refund: REFUNDED; replay stable');
console.log('Provider adapter demo passed. No network, database, card details or money involved.');
