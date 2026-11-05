import type { NextRequest } from 'next/server';
import { middleware } from './middleware';
jest.mock('next/server', () => ({
  NextResponse: {
    next: () => ({ kind: 'next' }),
    redirect: (url: URL) => ({ kind: 'redirect', url: url.href }),
    rewrite: (url: URL, init: { status: number }) => ({
      kind: 'rewrite',
      url: url.href,
      status: init.status,
    }),
  },
}));
function request(cookie = true) {
  return {
    url: 'http://localhost:3000/admin/orders?status=PAID',
    nextUrl: new URL('http://localhost:3000/admin/orders?status=PAID'),
    cookies: { get: () => (cookie ? 'test-cookie' : undefined) },
    headers: new Headers({ cookie: 'tea_access=test-cookie' }),
  } as unknown as NextRequest;
}
afterEach(() => jest.restoreAllMocks());
it('does not request or render private admin content without a session', async () => {
  const fetcher = jest.spyOn(global, 'fetch');
  expect(await middleware(request(false))).toMatchObject({
    kind: 'redirect',
    url: 'http://localhost:3000/login?next=%2Fadmin%2Forders%3Fstatus%3DPAID',
  });
  expect(fetcher).not.toHaveBeenCalled();
});
it('checks the real gateway role and fails closed when validation is unavailable', async () => {
  const fetcher = jest.spyOn(global, 'fetch');
  fetcher.mockResolvedValueOnce(new Response('{}', { status: 403 }));
  expect(await middleware(request())).toMatchObject({ kind: 'rewrite', status: 403 });
  fetcher.mockResolvedValueOnce(new Response('{}', { status: 200 }));
  expect(await middleware(request())).toMatchObject({ kind: 'next' });
  fetcher.mockRejectedValueOnce(new Error('gateway unavailable'));
  expect(await middleware(request())).toMatchObject({ kind: 'rewrite', status: 503 });
  fetcher.mockResolvedValueOnce(new Response('{}', { status: 401 }));
  expect(await middleware(request())).toMatchObject({ kind: 'redirect' });
});
