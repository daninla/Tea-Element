import type { CookieOptions, Response } from 'express';
import type { AuthSession } from '@tea/contracts';
import { readEnvironment } from '../../../config/environment';
export function cookieOptions(path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: readEnvironment().NODE_ENV === 'production',
    sameSite: 'lax',
    path,
  };
}
export function setSession(response: Response, session: AuthSession) {
  response.setHeader('Cache-Control', 'no-store');
  response.cookie('tea_access', session.accessToken, {
    ...cookieOptions('/'),
    maxAge: 15 * 60 * 1000,
  });
  response.cookie('tea_refresh', session.refreshToken, {
    ...cookieOptions('/api/v1/auth'),
    maxAge: 7 * 86400000,
  });
  return session.user;
}
export function clearSession(response: Response) {
  response.setHeader('Cache-Control', 'no-store');
  response.clearCookie('tea_access', cookieOptions('/'));
  response.clearCookie('tea_refresh', cookieOptions('/api/v1/auth'));
}
