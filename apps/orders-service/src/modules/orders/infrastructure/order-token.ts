import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
export function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
export function orderToken(nonce: string, secret: string) {
  return createHmac('sha256', secret).update(`guest-order-v1:${nonce}`).digest('base64url');
}
export function matchesToken(token: string | undefined, hash: string) {
  return (
    typeof token === 'string' &&
    token.length === 43 &&
    timingSafeEqual(Buffer.from(digest(token), 'hex'), Buffer.from(hash, 'hex'))
  );
}
