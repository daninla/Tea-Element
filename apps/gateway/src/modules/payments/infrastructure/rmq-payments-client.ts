import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { OrdersRequest, OrdersResult } from '@tea/contracts';
import { PaymentsClient } from '../domain/payments-client';
@Injectable()
export class RmqPaymentsClient extends PaymentsClient implements OnModuleDestroy {
  constructor(@Inject('PAYMENTS_TRANSPORT') private readonly client: ClientProxy) {
    super();
  }
  async request<T>(pattern: string, request: OrdersRequest<unknown>): Promise<OrdersResult<T>> {
    try {
      return await firstValueFrom(
        this.client
          .send<OrdersResult<T>, OrdersRequest<unknown>>(pattern, request)
          .pipe(timeout(8000)),
      );
    } catch {
      return {
        ok: false,
        error: {
          code: 'PAYMENTS_UNAVAILABLE',
          message: 'Payments temporarily unavailable',
          statusCode: 503,
        },
      };
    }
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}
