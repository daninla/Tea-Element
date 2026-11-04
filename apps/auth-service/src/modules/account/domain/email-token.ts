import { createHmac, createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
export type ChallengeKind = 'VERIFY_EMAIL' | 'RESET_PASSWORD';
export function emailToken(id: string, nonce: string, kind: string, secret: string) {
  return (
    id +
    '.' +
    createHmac('sha256', secret).update(`tea-email:${kind}:${id}:${nonce}`).digest('base64url')
  );
}
export function tokenDigest(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function matchesEmailToken(token: string, digest: string) {
  const actual = Buffer.from(tokenDigest(token));
  const expected = Buffer.from(digest);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function newEmailChallenge(userId: string, kind: ChallengeKind, secret: string) {
  const id = randomUUID(),
    nonce = randomBytes(32).toString('base64url');
  return {
    id,
    userId,
    kind,
    nonce,
    tokenHash: tokenDigest(emailToken(id, nonce, kind, secret)),
    expiresAt: new Date(Date.now() + (kind === 'VERIFY_EMAIL' ? 86400000 : 1800000)),
  };
}
export function challengeId(token: string) {
  return /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[A-Za-z0-9_-]{43}$/.test(
    token,
  )
    ? token.slice(0, 36)
    : null;
}
