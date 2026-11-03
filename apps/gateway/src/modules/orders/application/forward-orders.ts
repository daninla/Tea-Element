import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { OrdersRequest } from '@tea/contracts';
import { OrdersClient } from '../domain/orders-client';
@Injectable()
export class ForwardOrders {
  constructor(@Inject(OrdersClient) private readonly client: OrdersClient) {}
  async execute<T>(pattern: string, request: OrdersRequest<unknown>): Promise<T> {
    const result = await this.client.request<T>(pattern, request);
    if (!result.ok) throw new HttpException(result.error, result.error.statusCode);
    return result.value;
  }
}
