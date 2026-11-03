import { Refresh } from './refresh';
import { hashToken } from '../domain/session';
import { context, dependencies } from '../../../../test/auth-fixtures';
describe('Refresh', () => {
  it('rotates the hash and never reuses the submitted opaque token', async () => {
    const d = dependencies();
    const token = 'old-refresh-token';
    const result = await new Refresh(d.store, d.signer).execute({ input: { token }, context });
    expect(d.methods.rotate).toHaveBeenCalledWith(
      hashToken(token),
      expect.objectContaining({ tokenHash: hashToken(result.refreshToken) }),
      expect.any(Date),
    );
    expect(result.refreshToken).not.toBe(token);
  });
  it.each(['invalid', 'replayed'])('does not sign credentials for %s sessions', async (kind) => {
    const d = dependencies();
    d.methods.rotate.mockResolvedValue({ kind });
    await expect(
      new Refresh(d.store, d.signer).execute({ input: { token: 'old' }, context }),
    ).rejects.toMatchObject({ code: 'INVALID_SESSION' });
    expect(d.sign).not.toHaveBeenCalled();
  });
});
