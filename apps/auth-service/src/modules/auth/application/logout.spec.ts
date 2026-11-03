import { Logout } from './logout';
import { hashToken } from '../domain/session';
import { context, dependencies } from '../../../../test/auth-fixtures';
describe('Logout', () => {
  it('revokes the family through the token hash', async () => {
    const d = dependencies();
    await new Logout(d.store).execute({ input: { token: 'opaque-secret' }, context });
    expect(d.methods.revoke).toHaveBeenCalledWith(hashToken('opaque-secret'), expect.any(Date));
  });
  it('is idempotent for an absent cookie', async () => {
    const d = dependencies();
    expect(await new Logout(d.store).execute({ input: { token: '' }, context })).toEqual({
      loggedOut: true,
    });
    expect(d.methods.revoke).not.toHaveBeenCalled();
  });
});
