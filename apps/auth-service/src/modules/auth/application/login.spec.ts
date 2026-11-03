import { Login } from './login';
import { context, dependencies, user } from '../../../../test/auth-fixtures';
describe('Login', () => {
  const request = { input: { email: 'BUYER@example.test', password: 'password123' }, context };
  it('creates a hashed refresh session for valid credentials', async () => {
    const d = dependencies();
    const result = await new Login(d.store, d.passwords, d.signer).execute(request);
    expect(d.methods.findByEmail).toHaveBeenCalledWith('buyer@example.test');
    expect(d.methods.createSession).toHaveBeenCalledWith(
      user.id,
      expect.objectContaining({ tokenHash: expect.any(String) }),
    );
    expect(result.user).not.toHaveProperty('passwordHash');
  });
  it.each(['unknown', 'inactive', 'wrong-password'])(
    'rejects %s with the same error and no session',
    async (scenario) => {
      const d = dependencies();
      if (scenario === 'unknown') d.methods.findByEmail.mockResolvedValue(null);
      if (scenario === 'inactive')
        d.methods.findByEmail.mockResolvedValue({ ...user, isActive: false });
      if (scenario === 'wrong-password') d.verify.mockResolvedValue(false);
      await expect(
        new Login(d.store, d.passwords, d.signer).execute(request),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
      expect(d.verify).toHaveBeenCalled();
      expect(d.methods.createSession).not.toHaveBeenCalled();
    },
  );
});
