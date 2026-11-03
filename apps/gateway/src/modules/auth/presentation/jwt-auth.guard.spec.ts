import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PUBLIC, OPTIONAL_AUTH, type AuthenticatedRequest } from './auth-policy';
function setup(isPublic: boolean, optional: boolean, token = 'expired') {
  const request = { cookies: { tea_access: token } } as unknown as AuthenticatedRequest;
  const reflector = {
    getAllAndOverride: (key: string) =>
      key === PUBLIC ? isPublic : key === OPTIONAL_AUTH ? optional : undefined,
  } as unknown as Reflector;
  const jwt = {
    verifyAsync: jest.fn().mockRejectedValue(new Error('expired')),
  } as unknown as JwtService;
  const context = {
    getHandler: () => () => {},
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard: new JwtAuthGuard(reflector, jwt), context, request, jwt };
}
describe('optional guest authentication', () => {
  it('lets the order service validate a bearer link when an unrelated cookie has expired', async () => {
    const { guard, context, request } = setup(true, true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });
  it('still rejects expired authentication on private cart routes', async () => {
    const { guard, context } = setup(false, false);
    await expect(guard.canActivate(context)).rejects.toThrow('Authentication required');
  });
  it('does not attempt authentication for a guest with no cookie', async () => {
    const { guard, context, jwt } = setup(true, true, '');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });
});
