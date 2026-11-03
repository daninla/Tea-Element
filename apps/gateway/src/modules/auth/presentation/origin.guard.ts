import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { readEnvironment } from '../../../config/environment';
@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
    if (request.headers.origin !== readEnvironment().CORS_ORIGIN)
      throw new ForbiddenException({ code: 'INVALID_ORIGIN', message: 'Untrusted request origin' });
    return true;
  }
}
