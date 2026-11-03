import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@tea/contracts';
import { ROLES, type AuthenticatedRequest } from './auth-policy';
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const configured = this.reflector.getAllAndOverride<Role[]>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    const adminPath = /^\/api\/v1\/admin(?:\/|$)/.test(request.path);
    const required = adminPath ? [Role.ADMIN] : configured;
    if (required?.length && (!request.user || !required.includes(request.user.role)))
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient permissions' });
    return true;
  }
}
