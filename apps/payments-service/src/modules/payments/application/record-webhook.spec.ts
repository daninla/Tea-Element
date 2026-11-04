import { RecordWebhook } from './record-webhook';
import { FakePaymentProvider } from '../infrastructure/fake-payment-provider';
import type { PaymentStore } from '../domain/payment-store';
const id = '22222222-2222-4222-8222-222222222222';
const payment = { id, provider: 'FAKE', amount: 100, currency: 'UAH', status: 'PENDING' };
const intent = {
  paymentId: id,
  amount: 100,
  currency: 'UAH' as const,
  orderNumber: 'TE-1',
  returnUrl: 'http://localhost:3000',
  expiresAt: '2099-01-01T00:00:00Z',
};
describe('RecordWebhook', () => {
  const provider = new FakePaymentProvider('x'.repeat(32));
  const store = {
    audit: jest.fn().mockResolvedValue('audit'),
    auditOutcome: jest.fn(),
    find: jest.fn().mockResolvedValue(payment),
    observe: jest.fn(),
  };
  const useCase = new RecordWebhook(store as unknown as PaymentStore, provider);
  beforeEach(() => {
    jest.clearAllMocks();
    store.find.mockResolvedValue(payment);
  });
  it('audits forged signatures before rejecting, without a payment read or state mutation', async () => {
    const raw = { data: 'untrusted', signature: 'forged' };
    await expect(useCase.execute(raw, 'correlation')).rejects.toThrow('INVALID_SIGNATURE');
    expect(store.audit).toHaveBeenCalledWith(raw, false);
    expect(store.find).not.toHaveBeenCalled();
    expect(store.observe).not.toHaveBeenCalled();
    expect(store.auditOutcome).toHaveBeenCalledWith('audit', 'INVALID_SIGNATURE');
  });
  it('checks the stored amount before applying a valid callback', async () => {
    await provider.createCheckout(intent);
    const raw = provider.settle(id, 'SUCCEEDED');
    store.find.mockResolvedValueOnce({ ...payment, amount: 101 });
    await expect(useCase.execute(raw, 'c')).rejects.toThrow('PAYMENT_MISMATCH');
    expect(store.audit).toHaveBeenCalledWith(raw, true);
    expect(store.observe).not.toHaveBeenCalled();
  });
  it('passes only verified observations into the atomic store, including replay', async () => {
    await provider.createCheckout(intent);
    const raw = provider.settle(id, 'SUCCEEDED');
    await useCase.execute(raw, 'c');
    await useCase.execute(raw, 'c');
    expect(store.observe).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: id, status: 'SUCCEEDED', amount: 100 }),
      'c',
    );
    expect(store.auditOutcome).toHaveBeenCalledWith('audit', 'APPLIED', id);
  });
  it('retains the audit when the atomic store fails', async () => {
    await provider.createCheckout(intent);
    const raw = provider.settle(id, 'SUCCEEDED');
    store.observe.mockRejectedValueOnce(new Error('database'));
    await expect(useCase.execute(raw, 'c')).rejects.toThrow();
    expect(store.auditOutcome).toHaveBeenCalledWith('audit', 'PAYMENTS_UNAVAILABLE');
  });
});
