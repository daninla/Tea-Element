let tail: Promise<unknown> = Promise.resolve();
export function withSessionLock<T>(run: () => Promise<T>): Promise<T> {
  const operation = tail
    .catch(() => {})
    .then(async (): Promise<T> => {
      if (typeof navigator !== 'undefined' && navigator.locks) {
        return await navigator.locks.request('tea-auth-session', async () => await run());
      }
      return await run();
    });
  tail = operation.catch(() => {});
  return operation;
}
