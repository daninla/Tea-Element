import { createHmac, timingSafeEqual } from 'node:crypto';
export function unsubscribeToken(id: string, nonce: string, secret: string) {
  return `${id}.${createHmac('sha256', secret).update(`marketing-unsubscribe-v1:${id}:${nonce}`).digest('base64url')}`;
}
export function validUnsubscribe(token: string, id: string, nonce: string, secret: string) {
  const expected = unsubscribeToken(id, nonce, secret);
  return (
    Buffer.byteLength(token) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(token), Buffer.from(expected))
  );
}
