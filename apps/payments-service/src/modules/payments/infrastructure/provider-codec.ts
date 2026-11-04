import { timingSafeEqual } from 'node:crypto';
import { PaymentProviderError, type ProviderWebhook } from '../domain/payment-provider';
export const MAX_WEBHOOK_DATA_LENGTH = 65_536;
export function encodePayload(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}
export function validEnvelope(input: ProviderWebhook): boolean {
  return (
    typeof input?.data === 'string' &&
    input.data.length > 0 &&
    input.data.length <= MAX_WEBHOOK_DATA_LENGTH &&
    typeof input.signature === 'string' &&
    input.signature.length <= 128
  );
}
export function equalSignature(actual: string, expected: string): boolean {
  // Compare canonical encodings: Buffer.from(base64) alone silently ignores invalid characters.
  const a = Buffer.from(actual, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
export function decodePayload(data: string): unknown {
  try {
    const decoded = Buffer.from(data, 'base64');
    if (decoded.toString('base64') !== data) throw new Error();
    return JSON.parse(decoded.toString('utf8')) as unknown;
  } catch {
    throw new PaymentProviderError('INVALID_RESPONSE');
  }
}
