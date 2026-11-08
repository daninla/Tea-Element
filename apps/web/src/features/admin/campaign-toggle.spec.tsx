/** @jest-environment jsdom */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { webcrypto } from 'node:crypto';
import { TextEncoder } from 'node:util';
import { CampaignToggle } from './admin-campaigns-page';
import { campaignAdminApi } from '@/lib/api/campaign-admin';
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/api/campaign-admin', () => ({ campaignAdminApi: { configure: jest.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, TextEncoder });
Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
test('retries an uncertain toggle with the same persisted command and prevents double submission', async () => {
  const configure = jest.mocked(campaignAdminApi.configure),
    client = new QueryClient(),
    container = document.createElement('div'),
    root = createRoot(container);
  const setting = { campaign: 'DISCOUNT' as const, enabled: false, revision: 0 };
  let reject!: (e: Error) => void;
  configure.mockImplementationOnce(
    () =>
      new Promise((_resolve, r) => {
        reject = r;
      }),
  );
  client.setQueryData(['campaign-settings'], [setting]);
  document.body.append(container);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <CampaignToggle setting={setting} actorId="admin" />
        </QueryClientProvider>,
      ),
    );
    const button = container.querySelector('button')!;
    await act(async () => {
      button.click();
      button.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(configure).toHaveBeenCalledTimes(1);
    const first = configure.mock.calls[0]![0];
    await act(async () => reject(new Error('timeout')));
    expect(sessionStorage.getItem('tea-campaign-command:admin:DISCOUNT')).toContain(first.key);
    configure.mockResolvedValueOnce({ ...setting, enabled: true, revision: 1 });
    await act(async () => {
      button.click();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(configure.mock.calls[1]![0]).toEqual(first);
    expect(sessionStorage.getItem('tea-campaign-command:admin:DISCOUNT')).toBeNull();
    expect(client.getQueryData(['campaign-settings'])).toEqual([
      { ...setting, enabled: true, revision: 1 },
    ]);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    container.remove();
    sessionStorage.clear();
  }
});
