import { z } from 'zod';
const attemptSchema = z
  .object({ key: z.string().uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export async function fingerprintOrder(input: unknown) {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(input)),
  );
  return Array.from(new Uint8Array(bytes), (x) => x.toString(16).padStart(2, '0')).join('');
}
export function checkoutAttempt(fingerprint: string, stored: string | null, newKey: () => string) {
  try {
    const result = attemptSchema.safeParse(JSON.parse(stored ?? 'null'));
    if (result.success && result.data.fingerprint === fingerprint) return result.data;
  } catch {
    /* A corrupt browser cache must not block checkout. */
  }
  return { key: newKey(), fingerprint };
}
