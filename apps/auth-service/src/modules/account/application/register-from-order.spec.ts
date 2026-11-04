import type { OrderView } from '@tea/contracts';
import { Register } from '../../auth/application/register';
import { RegistrationOrderAccess } from '../domain/account-store';
import { RegisterFromOrder } from './register-from-order';
it('requires private order access and takes identity only from its trusted snapshot', async () => {
  const get = jest.fn();
  const execute = jest.fn();
  const useCase = new RegisterFromOrder(
    { get } as RegistrationOrderAccess,
    { execute } as unknown as Register,
  );
  const input = { number: 'TE-test', token: 'secret', password: 'new-password' };
  get.mockRejectedValueOnce(new Error('private order unavailable'));
  await expect(useCase.execute(input, { correlationId: 'test' })).rejects.toThrow(
    'private order unavailable',
  );
  expect(execute).not.toHaveBeenCalled();
  get.mockResolvedValue({
    email: 'snapshot@example.test',
    firstName: 'Tea',
    lastName: 'Buyer',
    phone: '+380501234567',
  } as OrderView);
  await useCase.execute(input, { correlationId: 'test' });
  expect(execute).toHaveBeenCalledWith({
    input: {
      email: 'snapshot@example.test',
      firstName: 'Tea',
      lastName: 'Buyer',
      phone: '+380501234567',
      password: 'new-password',
      marketingConsent: false,
    },
    context: { correlationId: 'test' },
  });
});
