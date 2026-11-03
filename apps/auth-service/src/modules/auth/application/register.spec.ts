import { Register } from './register';
import { context, dependencies } from '../../../../test/auth-fixtures';
describe('Register', () => {
  it('normalizes email and atomically delegates user, session hash and outbox event', async () => {
    const d = dependencies();
    const result = await new Register(d.store, d.passwords, d.signer).execute({
      input: {
        email: 'BUYER@example.test',
        password: 'password123',
        firstName: ' Tea ',
        lastName: 'Buyer',
      },
      context,
    });
    const [input, session, event] = d.methods.register.mock.calls[0]!;
    expect(input.email).toBe('buyer@example.test');
    expect(input.marketingConsent).toBe(false);
    expect(input.passwordHash).toBe('stored-hash');
    expect(session.tokenHash).toHaveLength(64);
    expect(session.tokenHash).not.toBe(result.refreshToken);
    expect(event.payload).not.toHaveProperty('password');
    expect(event.payload).not.toHaveProperty('token');
    expect(result.user).not.toHaveProperty('passwordHash');
  });
  it('does not issue tokens if atomic persistence fails', async () => {
    const d = dependencies();
    d.methods.register.mockRejectedValue(new Error('transaction failed'));
    await expect(
      new Register(d.store, d.passwords, d.signer).execute({
        input: {
          email: 'buyer@example.test',
          password: 'password123',
          firstName: 'Tea',
          lastName: 'Buyer',
        },
        context,
      }),
    ).rejects.toThrow();
    expect(d.sign).not.toHaveBeenCalled();
  });
});
