import { NextResponse, type NextRequest } from 'next/server';
export async function middleware(request: NextRequest) {
  const admin =
    request.nextUrl.pathname === '/admin' || request.nextUrl.pathname.startsWith('/admin/');
  const login = () => {
    const url = new URL('/login', request.url);
    url.searchParams.set(
      'next',
      admin ? request.nextUrl.pathname + request.nextUrl.search : '/account',
    );
    return NextResponse.redirect(url);
  };
  if (!request.cookies.get('tea_access') && !request.cookies.get('tea_refresh')) return login();
  if (admin) {
    try {
      const response = await fetch(
        new URL('/api/v1/admin/auth/me', process.env.INTERNAL_API_URL ?? 'http://localhost:4000'),
        {
          headers: { cookie: request.headers.get('cookie') ?? '' },
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        },
      );
      if (response.status === 401) return login();
      if (response.status === 403)
        return NextResponse.rewrite(new URL('/access-denied', request.url), { status: 403 });
      if (!response.ok) throw new Error('Unavailable');
    } catch {
      return NextResponse.rewrite(new URL('/admin-unavailable', request.url), { status: 503 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ['/account/:path*', '/admin/:path*'] };
