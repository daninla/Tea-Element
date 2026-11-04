import { HandlePaymentEvent } from './handle-payment-event';
import type { PaymentStore } from '../domain/payment-store';
import type { PaymentRequested, OrderCancelled } from '@tea/contracts';
it('keeps cancellation separate from creation so reordered events can leave a tombstone', async () => {
  const store = { register: jest.fn(), cancel: jest.fn() };
  const handler = new HandlePaymentEvent(store as unknown as PaymentStore);
  const cancel = { name: 'OrderCancelled', payload: { orderId: 'o' } } as OrderCancelled;
  const create = { name: 'PaymentRequested', payload: { orderId: 'o' } } as PaymentRequested;
  await handler.execute(cancel);
  await handler.execute(create);
  expect(store.cancel).toHaveBeenCalledWith(cancel);
  expect(store.register).toHaveBeenCalledWith(create);
});
