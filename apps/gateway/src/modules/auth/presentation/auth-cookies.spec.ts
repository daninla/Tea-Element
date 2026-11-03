import { cookieOptions } from './auth-cookies';
describe('session cookie policy', () => {
  it('requires Secure cookies in production and keeps the refresh scope narrow', () => {
    const before = {
      NODE_ENV: process.env.NODE_ENV,
      JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    };
    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_ACCESS_SECRET = 'test-secret-not-a-production-credential-1234';
      expect(cookieOptions('/api/v1/auth')).toEqual({
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/api/v1/auth',
      });
      process.env.NODE_ENV = 'development';
      expect(cookieOptions('/').secure).toBe(false);
    } finally {
      for (const [name, value] of Object.entries(before)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });
});
