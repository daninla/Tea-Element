import { GetCurrentUser } from './get-current-user';
import { context, dependencies, user } from '../../../../test/auth-fixtures';
describe('GetCurrentUser', () => {
  it('returns only public fields', async () => {
    const d = dependencies();
    const result = await new GetCurrentUser(d.store).execute({
      input: { userId: user.id },
      context,
    });
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('isActive');
  });
  it.each([null, { ...user, isActive: false }])(
    'rejects missing and disabled users',
    async (result) => {
      const d = dependencies();
      d.methods.findById.mockResolvedValue(result);
      await expect(
        new GetCurrentUser(d.store).execute({ input: { userId: user.id }, context }),
      ).rejects.toMatchObject({ code: 'USER_UNAVAILABLE' });
    },
  );
});
