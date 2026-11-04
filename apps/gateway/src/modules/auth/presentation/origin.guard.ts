import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { readEnvironment } from '../../../config/environment';
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (this.reflector.get<boolean>('tea.provider_callback', context.getHandler())) return true;
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    if (request.headers.origin !== readEnvironment().CORS_ORIGIN)
      throw new ForbiddenException({ code: 'INVALID_ORIGIN', message: 'Untrusted request origin' });
    return true;
  }
}
