import { DeliverPaymentNotice } from './deliver-payment-notice';
import type {
  PaymentNotice,
  PaymentNoticeStore,
  PaymentNoticeSender,
} from '../domain/payment-notice';
const notice = { id: 'notice', leaseId: 'lease' } as PaymentNotice;
function setup() {
  const store = { claim: jest.fn().mockResolvedValue(notice), finish: jest.fn() };
  const sender = { send: jest.fn() };
  return {
    store,
    sender,
    deliver: new DeliverPaymentNotice(store as PaymentNoticeStore, sender as PaymentNoticeSender),
  };
}
it('does not contact SMTP when no delivery is due', async () => {
  const { store, sender, deliver } = setup();
  store.claim.mockResolvedValue(null);
  expect(await deliver.execute()).toBe(false);
  expect(sender.send).not.toHaveBeenCalled();
});
it('marks SMTP acceptance only after send completes with the claimed lease', async () => {
  const { store, sender, deliver } = setup();
  expect(await deliver.execute()).toBe(true);
  expect(sender.send).toHaveBeenCalledWith(notice);
  expect(store.finish).toHaveBeenCalledWith('notice', 'lease', true);
  expect(sender.send.mock.invocationCallOrder[0]).toBeLessThan(
    store.finish.mock.invocationCallOrder[0]!,
  );
});
it('records failure without exposing raw SMTP errors and lets storage failures expire the lease', async () => {
  const { store, sender, deliver } = setup();
  sender.send.mockRejectedValue(new Error('private address and token'));
  expect(await deliver.execute()).toBe(true);
  expect(store.finish).toHaveBeenCalledWith('notice', 'lease', false);
  store.finish.mockRejectedValue(new Error('db unavailable'));
  await expect(deliver.execute()).rejects.toThrow('db unavailable');
});
