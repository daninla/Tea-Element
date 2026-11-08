import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { OrdersRequest } from '@tea/contracts';
import { MarketingClient } from '../domain/marketing-client';
@Injectable()
export class ForwardMarketing {
  constructor(@Inject(MarketingClient) private readonly client: MarketingClient) {}
  async execute<T>(pattern: string, request: OrdersRequest<unknown>): Promise<T> {
    const result = await this.client.request<T>(pattern, request);
    if (!result.ok) throw new HttpException(result.error, result.error.statusCode);
    return result.value;
  }
}
