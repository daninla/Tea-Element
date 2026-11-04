export interface AccessStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const validToken = (token: string | undefined | null) =>
  !!token && /^[A-Za-z0-9_-]{43}$/.test(token);
export function rememberAccess(storage: AccessStorage, number: string, token: string): boolean {
  if (!validToken(token)) return false;
  try {
    storage.setItem(`tea-order-access:${number}`, token);
    return true;
  } catch {
    return false;
  }
}
export function restoreAccess(storage: AccessStorage, number: string): string | undefined {
  try {
    const token = storage.getItem(`tea-order-access:${number}`);
    return validToken(token) ? token! : undefined;
  } catch {
    return undefined;
  }
}
export function paymentCommandKey(
  storage: AccessStorage,
  number: string,
  attempt: string,
  action: string,
  uuid: () => string,
): string {
  const name = `tea-payment-command:${number}:${attempt}:${action}`;
  const old = storage.getItem(name);
  if (old && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(old))
    return old;
  const key = uuid();
  storage.setItem(name, key);
  return key;
}
