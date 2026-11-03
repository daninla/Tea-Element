import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { AuthRequest } from '@tea/contracts';
import { AuthClient } from '../domain/auth-client';
@Injectable()
export class ForwardAuth {
  constructor(@Inject(AuthClient) private readonly client: AuthClient) {}
  async execute<T>(pattern: string, request: AuthRequest<unknown>): Promise<T> {
    const result = await this.client.request<T>(pattern, request);
    if (!result.ok) throw new HttpException(result.error, result.error.statusCode);
    return result.value;
  }
}
