import { randomUUID } from 'node:crypto';
import {
  challengeId,
  emailToken,
  matchesEmailToken,
  newEmailChallenge,
  tokenDigest,
} from './email-token';
describe('email proofs', () => {
  it('stores only a digest and binds the proof to its purpose and signing key', () => {
    const row = newEmailChallenge(randomUUID(), 'VERIFY_EMAIL', 'secret');
    const token = emailToken(row.id, row.nonce, row.kind, 'secret');
    expect(challengeId(token)).toBe(row.id);
    expect(row.tokenHash).toBe(tokenDigest(token));
    expect(matchesEmailToken(token, row.tokenHash)).toBe(true);
    expect(
      matchesEmailToken(emailToken(row.id, row.nonce, 'RESET_PASSWORD', 'secret'), row.tokenHash),
    ).toBe(false);
    expect(matchesEmailToken(emailToken(row.id, row.nonce, row.kind, 'other'), row.tokenHash)).toBe(
      false,
    );
    expect(matchesEmailToken(token + 'x', row.tokenHash)).toBe(false);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(challengeId('arbitrary.id')).toBeNull();
  });
  it('uses unique nonces and shorter expiry for password recovery', () => {
    const user = randomUUID();
    const a = newEmailChallenge(user, 'RESET_PASSWORD', 'secret');
    const b = newEmailChallenge(user, 'RESET_PASSWORD', 'secret');
    expect(a.nonce).not.toBe(b.nonce);
    expect(a.tokenHash).not.toBe(b.tokenHash);
    expect(a.expiresAt.getTime() - Date.now()).toBeGreaterThan(1790000);
    expect(a.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(1800000);
  });
});
