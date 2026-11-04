import { GetPayment } from './get-payment';
import type { PaymentStore, PaymentOrderAccess } from '../domain/payment-store';
import type { PaymentProvider } from '../domain/payment-provider';
describe('GetPayment', () => {
  const orders = { get: jest.fn() };
  const store = { forOrder: jest.fn() };
  const provider = { createCheckout: jest.fn() };
  const useCase = new GetPayment(
    store as unknown as PaymentStore,
    provider as unknown as PaymentProvider,
    orders as PaymentOrderAccess,
  );
  const request = {
    input: { number: 'TE-one', token: 'private' },
    context: { correlationId: 'c' },
  };
  beforeEach(() => jest.clearAllMocks());
  it('checks order access before looking up any payment details', async () => {
    orders.get.mockRejectedValueOnce(new Error('ORDER_NOT_FOUND'));
    await expect(useCase.execute(request, false)).rejects.toThrow('ORDER_NOT_FOUND');
    expect(store.forOrder).not.toHaveBeenCalled();
  });
  it('creates checkout only for a reserved, unexpired online order', async () => {
    orders.get.mockResolvedValue({
      id: 'order',
      number: 'TE-one',
      status: 'AWAITING_PAYMENT',
      paymentMethod: 'ONLINE_CARD',
    });
    store.forOrder.mockResolvedValue({
      id: 'payment',
      orderId: 'order',
      status: 'PENDING',
      amount: 100,
      currency: 'UAH',
      provider: 'FAKE',
      expiresAt: '2099-01-01T00:00:00Z',
      cancelRequested: false,
    });
    provider.createCheckout.mockResolvedValue({ provider: 'FAKE', paymentId: 'payment' });
    expect(await useCase.execute(request, true)).toMatchObject({ checkout: { provider: 'FAKE' } });
    expect(provider.createCheckout.mock.calls[0]![0]).not.toHaveProperty('token');
    store.forOrder.mockResolvedValueOnce({
      id: 'payment',
      status: 'PENDING',
      provider: 'FAKE',
      cancelRequested: true,
    });
    await expect(useCase.execute(request, true)).rejects.toThrow('PAYMENT_NOT_PAYABLE');
  });
});
