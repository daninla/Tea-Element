import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { AuthRequest, RpcResult } from '@tea/contracts';
import { AuthClient } from '../domain/auth-client';
@Injectable()
export class RmqAuthClient extends AuthClient implements OnModuleDestroy {
  constructor(@Inject('AUTH_TRANSPORT') private readonly client: ClientProxy) {
    super();
  }
  async request<T>(pattern: string, request: AuthRequest<unknown>): Promise<RpcResult<T>> {
    try {
      return await firstValueFrom(
        this.client.send<RpcResult<T>, AuthRequest<unknown>>(pattern, request).pipe(timeout(8000)),
      );
    } catch {
      return {
        ok: false,
        error: {
          code: 'AUTH_UNAVAILABLE',
          message: 'Authentication temporarily unavailable',
          statusCode: 503,
        },
      };
    }
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}
