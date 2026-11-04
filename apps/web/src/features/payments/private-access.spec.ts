import { rememberAccess, restoreAccess, paymentCommandKey } from './private-access';
describe('private payment return access', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  beforeEach(() => values.clear());
  it('restores only the token for the returning order and rejects malformed values', () => {
    expect(rememberAccess(storage, 'one', 'A'.repeat(43))).toBe(true);
    expect(restoreAccess(storage, 'one')).toBe('A'.repeat(43));
    expect(restoreAccess(storage, 'two')).toBeUndefined();
    expect(rememberAccess(storage, 'two', 'bad')).toBe(false);
  });
  it('handles blocked storage without inventing guest access', () => {
    const blocked = {
      getItem: () => {
        throw new Error();
      },
      setItem: () => {
        throw new Error();
      },
    };
    expect(restoreAccess(blocked, 'one')).toBeUndefined();
    expect(rememberAccess(blocked, 'one', 'A'.repeat(43))).toBe(false);
  });
  it('reuses a command key after a lost response but isolates action and attempt', () => {
    let sequence = 0;
    const uuid = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`;
    const first = paymentCommandKey(storage, 'one', 'attempt-1', 'RETRY', uuid);
    expect(paymentCommandKey(storage, 'one', 'attempt-1', 'RETRY', uuid)).toBe(first);
    expect(paymentCommandKey(storage, 'one', 'attempt-2', 'RETRY', uuid)).not.toBe(first);
    expect(paymentCommandKey(storage, 'one', 'attempt-1', 'COD', uuid)).not.toBe(first);
  });
});
