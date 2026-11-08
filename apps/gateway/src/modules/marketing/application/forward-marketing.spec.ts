import { ForwardMarketing } from './forward-marketing';
import type { MarketingClient } from '../domain/marketing-client';
it('forwards the public token without fabricating success on a transport failure', async () => {
  const request = jest.fn().mockResolvedValue({
      ok: false,
      error: { statusCode: 503, code: 'MARKETING_UNAVAILABLE', message: 'Unavailable' },
    }),
    input = { input: { token: 'proof' }, context: { correlationId: 'test' } };
  await expect(
    new ForwardMarketing({ request } as MarketingClient).execute('marketing.unsubscribe', input),
  ).rejects.toThrow('Unavailable');
  expect(request).toHaveBeenCalledWith('marketing.unsubscribe', input);
});
