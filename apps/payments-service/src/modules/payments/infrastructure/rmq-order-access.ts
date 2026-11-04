import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { ORDERS_PATTERNS, type OrdersResult, type OrderView } from '@tea/contracts';
import { PaymentOrderAccess, PaymentError } from '../domain/payment-store';
@Injectable()
export class RmqOrderAccess extends PaymentOrderAccess implements OnModuleDestroy {
  constructor(@Inject('ORDERS_TRANSPORT') private readonly client: ClientProxy) {
    super();
  }
  async get(
    input: { number: string; token?: string },
    context: { correlationId: string; userId?: string },
  ) {
    let result: OrdersResult<OrderView>;
    try {
      result = await firstValueFrom(
        this.client
          .send<OrdersResult<OrderView>>(ORDERS_PATTERNS.get, { input, context })
          .pipe(timeout(5000)),
      );
    } catch {
      throw new PaymentError('ORDERS_UNAVAILABLE', 503);
    }
    if (!result.ok) throw new PaymentError(result.error.code, result.error.statusCode);
    return result.value;
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}
