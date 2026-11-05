import { z } from 'zod';
const schema = z
  .object({ key: z.string().uuid(), fingerprint: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export class PendingInventoryOperation extends Error {}
export async function inventoryAttempt(
  input: unknown,
  stored: string | null,
  newKey: () => string,
) {
  const data = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(input)),
  );
  const fingerprint = Array.from(new Uint8Array(data), (x) => x.toString(16).padStart(2, '0')).join(
    '',
  );
  if (stored) {
    let parsed;
    try {
      parsed = schema.safeParse(JSON.parse(stored));
    } catch {
      throw new PendingInventoryOperation();
    }
    if (!parsed.success || parsed.data.fingerprint !== fingerprint)
      throw new PendingInventoryOperation();
    return parsed.data;
  }
  return { key: newKey(), fingerprint };
}
