import { webcrypto, randomUUID } from 'node:crypto';
import { inventoryAttempt, PendingInventoryOperation } from './inventory-attempt';
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
it('reuses a persisted command after uncertain delivery without storing invoice data', async () => {
  const input = { supplier: 'Private supplier', quantity: 25, note: 'Private invoice' };
  const first = await inventoryAttempt(input, null, randomUUID);
  const saved = JSON.stringify(first);
  expect(saved).not.toContain('Private');
  const second = await inventoryAttempt(input, saved, () => {
    throw new Error('must reuse key');
  });
  expect(second).toEqual(first);
  await expect(
    inventoryAttempt({ ...input, quantity: 26 }, saved, randomUUID),
  ).rejects.toBeInstanceOf(PendingInventoryOperation);
});
it('does not silently discard corrupt pending metadata', async () => {
  await expect(
    inventoryAttempt({ quantity: 1 }, 'invalid-json', randomUUID),
  ).rejects.toBeInstanceOf(PendingInventoryOperation);
});
