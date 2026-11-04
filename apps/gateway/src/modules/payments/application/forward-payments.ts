import { HttpException, Inject, Injectable } from '@nestjs/common';
import type { OrdersRequest } from '@tea/contracts';
import { PaymentsClient } from '../domain/payments-client';
@Injectable()
export class ForwardPayments {
  constructor(@Inject(PaymentsClient) private readonly client: PaymentsClient) {}
  async execute<T>(pattern: string, request: OrdersRequest<unknown>): Promise<T> {
    const result = await this.client.request<T>(pattern, request);
    if (!result.ok) throw new HttpException(result.error, result.error.statusCode);
    return result.value;
  }
}
