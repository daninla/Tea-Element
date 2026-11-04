import { SimulatePayment } from './simulate-payment';
import type { GetPayment } from './get-payment';
import type { RecordWebhook } from './record-webhook';
import type { PaymentSimulator } from '../domain/payment-simulator';
let mockMode = { PAYMENT_PROVIDER: 'fake', NODE_ENV: 'test' };
jest.mock('../../../config/environment', () => ({ readEnvironment: () => mockMode }));
describe('authorized offline simulation', () => {
  const get = { execute: jest.fn() };
  const simulator = { settle: jest.fn() };
  const record = { execute: jest.fn() };
  const useCase = new SimulatePayment(
    get as unknown as GetPayment,
    simulator as PaymentSimulator,
    record as unknown as RecordWebhook,
  );
  const request = { input: { number: 'one', token: 'private' }, context: { correlationId: 'c' } };
  beforeEach(() => {
    jest.clearAllMocks();
    mockMode = { PAYMENT_PROVIDER: 'fake', NODE_ENV: 'test' };
  });
  it('does not settle or record a payment when order access is denied', async () => {
    get.execute.mockRejectedValueOnce(new Error('ORDER_NOT_FOUND'));
    await expect(useCase.execute(request, 'SUCCEEDED')).rejects.toThrow('ORDER_NOT_FOUND');
    expect(simulator.settle).not.toHaveBeenCalled();
    expect(record.execute).not.toHaveBeenCalled();
  });
  it('uses the existing signed/audited workflow after access and payability checks', async () => {
    get.execute.mockResolvedValueOnce({ payment: { id: 'p' } });
    simulator.settle.mockReturnValueOnce({ data: 'signed', signature: 'signature' });
    record.execute.mockResolvedValueOnce({ received: true });
    expect(await useCase.execute(request, 'FAILED')).toEqual({ received: true });
    expect(record.execute).toHaveBeenCalledWith({ data: 'signed', signature: 'signature' }, 'c');
  });
  it.each([
    { PAYMENT_PROVIDER: 'liqpay', NODE_ENV: 'test' },
    { PAYMENT_PROVIDER: 'fake', NODE_ENV: 'production' },
  ])('cannot simulate in %p', async (mode) => {
    mockMode = mode;
    await expect(useCase.execute(request, 'SUCCEEDED')).rejects.toThrow('SIMULATION_DISABLED');
    expect(get.execute).not.toHaveBeenCalled();
  });
});
