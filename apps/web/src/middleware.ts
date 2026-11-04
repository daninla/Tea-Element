import { NextResponse, type NextRequest } from 'next/server';
export function middleware(request: NextRequest) {
  // Cookie presence is a navigation gate only; gateway/auth enforce the actual session and ownership.
  if (!request.cookies.get('tea_access') && !request.cookies.get('tea_refresh'))
    return NextResponse.redirect(new URL('/login?next=/account', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/account/:path*'] };
