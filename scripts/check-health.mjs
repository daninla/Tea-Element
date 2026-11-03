const services = [
  'web',
  'gateway',
  'auth-service',
  'catalog-service',
  'orders-service',
  'payments-service',
  'marketing-service',
];
const results = await Promise.all(
  services.map(async (service, index) => {
    const port = index === 0 ? 3000 : 3999 + index;
    const url = `http://127.0.0.1:${port}/health`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const body = await response.json();
      if (!response.ok || body.status !== 'ok' || body.service !== service)
        throw new Error('Invalid liveness response');
      console.log(`${service}: healthy (${port})`);
      return true;
    } catch {
      console.error(`${service}: unavailable (${port})`);
      return false;
    }
  }),
);
if (results.some((healthy) => !healthy)) process.exitCode = 1;
