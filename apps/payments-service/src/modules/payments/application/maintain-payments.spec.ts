import { MaintainPayments } from './maintain-payments';
import type { PaymentStore } from '../domain/payment-store';
import type { PaymentProvider } from '../domain/payment-provider';
describe('MaintainPayments', () => {
  const store = {
    due: jest.fn(),
    observe: jest.fn(),
    defer: jest.fn(),
    expire: jest.fn(),
    claimRefund: jest.fn(),
    refundResult: jest.fn(),
  };
  const provider = { getStatus: jest.fn(), refund: jest.fn() };
  const useCase = new MaintainPayments(
    store as unknown as PaymentStore,
    provider as unknown as PaymentProvider,
  );
  beforeEach(() => {
    jest.clearAllMocks();
    store.due.mockResolvedValue([]);
    store.claimRefund.mockResolvedValue(null);
  });
  it('recovers a lost callback before applying expiry', async () => {
    store.due.mockResolvedValue([{ id: 'p', provider: 'FAKE', amount: 100, currency: 'UAH' }]);
    provider.getStatus.mockResolvedValue({
      paymentId: 'p',
      amount: 100,
      currency: 'UAH',
      status: 'SUCCEEDED',
    });
    await useCase.execute();
    expect(store.observe).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'SUCCEEDED' }),
      expect.any(String),
    );
    expect(store.observe.mock.invocationCallOrder[0]).toBeLessThan(
      store.expire.mock.invocationCallOrder[0]!,
    );
  });
  it('does not invent paid state during a provider outage', async () => {
    store.due.mockResolvedValue([{ id: 'p', provider: 'FAKE', amount: 100, currency: 'UAH' }]);
    provider.getStatus.mockRejectedValueOnce(new Error('offline'));
    await useCase.execute();
    expect(store.observe).not.toHaveBeenCalled();
    expect(store.expire).toHaveBeenCalled();
  });
  it('quarantines an ambiguous refund instead of retrying it', async () => {
    store.claimRefund.mockResolvedValueOnce({ id: 'p', amount: 100, currency: 'UAH' });
    provider.refund.mockRejectedValueOnce(new Error('timeout'));
    await useCase.execute();
    expect(store.refundResult).toHaveBeenCalledWith('p', 'REVIEW_REQUIRED', expect.any(String));
    expect(provider.refund).toHaveBeenCalledTimes(1);
  });
});
it('acknowledges only captured reconciliation requests even when provider status is unavailable', async () => {
  const commandIds = ['captured'];
  const store = {
    due: jest
      .fn()
      .mockResolvedValue([{ id: 'p', provider: 'FAKE', reconcileCommandIds: commandIds }]),
    defer: jest.fn(),
    expire: jest.fn(),
    claimRefund: jest.fn().mockResolvedValue(null),
  };
  const provider = { getStatus: jest.fn().mockRejectedValue(new Error('offline')) };
  await new MaintainPayments(
    store as unknown as PaymentStore,
    provider as unknown as PaymentProvider,
  ).execute();
  expect(store.defer).toHaveBeenCalledWith('p', commandIds);
});
