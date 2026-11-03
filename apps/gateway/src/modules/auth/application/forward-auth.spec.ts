import { HttpException } from '@nestjs/common';
import { ForwardAuth } from './forward-auth';
import { AuthClient } from '../domain/auth-client';
describe('ForwardAuth', () => {
  it('returns the typed result from the internal service', async () => {
    const client = {
      request: jest.fn().mockResolvedValue({ ok: true, value: { id: 'user' } }),
    } as unknown as AuthClient;
    expect(
      await new ForwardAuth(client).execute('auth.me', {
        input: { userId: 'user' },
        context: { correlationId: 'test' },
      }),
    ).toEqual({ id: 'user' });
  });
  it('turns a bounded transport failure into a safe 503 response', async () => {
    const client = {
      request: jest.fn().mockResolvedValue({
        ok: false,
        error: {
          code: 'AUTH_UNAVAILABLE',
          message: 'Authentication temporarily unavailable',
          statusCode: 503,
        },
      }),
    } as unknown as AuthClient;
    try {
      await new ForwardAuth(client).execute('auth.me', {
        input: {},
        context: { correlationId: 'test' },
      });
      throw new Error('Expected an HTTP exception');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(503);
      expect((error as HttpException).getResponse()).toMatchObject({ code: 'AUTH_UNAVAILABLE' });
    }
  });
});
