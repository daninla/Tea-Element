import { digest, matchesToken, orderToken } from './order-token';
describe('guest token', () => {
  it('recovers the same 32-byte bearer without storing plaintext', () => {
    const token = orderToken('random-nonce', 'secret');
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(matchesToken(token, digest(token))).toBe(true);
    expect(digest(token)).not.toContain(token);
  });
  it('rejects missing, malformed, wrong and rotated tokens', () => {
    const token = orderToken('nonce', 'secret');
    for (const value of [
      undefined,
      '',
      token + 'x',
      orderToken('other', 'secret'),
      orderToken('nonce', 'rotated'),
    ])
      expect(matchesToken(value, digest(token))).toBe(false);
  });
});
