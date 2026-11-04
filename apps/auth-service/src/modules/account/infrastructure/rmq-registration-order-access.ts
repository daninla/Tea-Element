import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { ORDERS_PATTERNS, type OrdersResult, type OrderView } from '@tea/contracts';
import { RegistrationOrderAccess } from '../domain/account-store';
import { AuthError } from '../../auth/domain/auth-error';
@Injectable()
export class RmqRegistrationOrderAccess extends RegistrationOrderAccess implements OnModuleDestroy {
  constructor(@Inject('ACCOUNT_ORDERS_TRANSPORT') private readonly client: ClientProxy) {
    super();
  }
  async get(number: string, token: string, correlationId: string) {
    let result: OrdersResult<OrderView>;
    try {
      result = await firstValueFrom(
        this.client
          .send<OrdersResult<OrderView>>(ORDERS_PATTERNS.get, {
            input: { number, token },
            context: { correlationId },
          })
          .pipe(timeout(5000)),
      );
    } catch {
      throw new AuthError('AUTH_UNAVAILABLE', 'Registration unavailable', 503);
    }
    if (!result.ok) throw new AuthError('INVALID_INPUT', 'Private order access required', 404);
    return result.value;
  }
  async onModuleDestroy() {
    await this.client.close();
  }
}
