/** @jest-environment jsdom */
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { UnsubscribePage } from './unsubscribe-page';
import { marketingApi } from '@/lib/api/marketing';
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
jest.mock('@/lib/api/marketing', () => ({ marketingApi: { unsubscribe: jest.fn() } }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
beforeEach(() => jest.clearAllMocks());
it('uses the fragment once under StrictMode and removes it from the visible URL', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const token = '11111111-1111-4111-8111-111111111111.' + 'a'.repeat(43);
  window.history.replaceState(null, '', '/unsubscribe#token=' + token);
  jest.mocked(marketingApi.unsubscribe).mockResolvedValue({ unsubscribed: true });
  try {
    await act(async () =>
      root.render(
        <StrictMode>
          <UnsubscribePage />
        </StrictMode>,
      ),
    );
    expect(marketingApi.unsubscribe).toHaveBeenCalledTimes(1);
    expect(marketingApi.unsubscribe).toHaveBeenCalledWith(token);
    expect(window.location.hash).toBe('');
    expect(container.textContent).toContain('done');
    expect(container.textContent).not.toContain(token);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
it('shows invalid links without sending a token or exposing an email address', async () => {
  const container = document.createElement('div');
  const root = createRoot(container);
  window.history.replaceState(null, '', '/unsubscribe#token=invalid');
  try {
    await act(async () => root.render(<UnsubscribePage />));
    expect(marketingApi.unsubscribe).not.toHaveBeenCalled();
    expect(container.textContent).toContain('invalid');
  } finally {
    await act(async () => root.unmount());
  }
});
