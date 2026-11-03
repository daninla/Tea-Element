import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@tea/contracts';
import type { AuthenticatedRequest } from '../modules/auth/presentation/auth-policy';
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const request = host.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = host.switchToHttp().getResponse<Response>();
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const raw = exception instanceof HttpException ? exception.getResponse() : null;
    const data = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const message =
      typeof data.message === 'string'
        ? data.message
        : statusCode === 400
          ? 'Invalid input'
          : statusCode >= 500
            ? 'Service temporarily unavailable'
            : 'Request rejected';
    const code =
      typeof data.code === 'string'
        ? data.code
        : statusCode === 400
          ? 'INVALID_INPUT'
          : statusCode === 429
            ? 'RATE_LIMITED'
            : `HTTP_${statusCode}`;
    response.setHeader('Cache-Control', 'no-store');
    response.status(statusCode).json({
      statusCode,
      code,
      message,
      correlationId: String(request.id ?? 'unknown'),
    } satisfies ApiError);
  }
}
