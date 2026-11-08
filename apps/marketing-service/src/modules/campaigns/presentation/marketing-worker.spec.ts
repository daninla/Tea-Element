import { randomUUID } from 'node:crypto';
import { marketingEventSchema } from './marketing-worker';
it('accepts legacy order snapshots without granting consent timestamps and rejects invalid time/shape', () => {
  const e = {
    eventId: randomUUID(),
    version: 1,
    occurredAt: '2026-10-01T00:00:00Z',
    correlationId: 'test',
    name: 'OrderCompleted',
    payload: {
      orderId: randomUUID(),
      userId: null,
      email: 'demo@example.test',
      firstName: 'Demo',
      lastName: 'Test',
      marketingConsent: true,
      total: 100,
      items: [{ productId: randomUUID(), quantity: 1 }],
    },
  };
  expect(marketingEventSchema.safeParse(e).success).toBe(true);
  expect(
    marketingEventSchema.safeParse({
      ...e,
      payload: { ...e.payload, marketingConsentAt: '2026-10-02T00:00:00Z' },
    }).success,
  ).toBe(false);
  expect(
    marketingEventSchema.safeParse({ ...e, payload: { ...e.payload, token: 'private' } }).success,
  ).toBe(false);
});
