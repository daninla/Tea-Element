import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { z } from 'zod';
import { Role } from '@tea/contracts';
import { readEnvironment } from '../../../config/environment';
import { cookie, PUBLIC, type AuthenticatedRequest } from './auth-policy';
const claims = z.object({
  sub: z.string().uuid(),
  email: z.string().email(),
  role: z.nativeEnum(Role),
});
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC, [context.getHandler(), context.getClass()])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    try {
      const decoded: unknown = await this.jwt.verifyAsync(cookie(request, 'tea_access'), {
        secret: readEnvironment().JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
        issuer: 'tea-auth',
        audience: 'tea-gateway',
      });
      request.user = claims.parse(decoded);
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }
  }
}
