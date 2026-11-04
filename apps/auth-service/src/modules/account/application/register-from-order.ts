import { Inject, Injectable } from '@nestjs/common';
import type { AuthContext } from '@tea/contracts';
import { Register } from '../../auth/application/register';
import { RegistrationOrderAccess } from '../domain/account-store';
@Injectable()
export class RegisterFromOrder {
  constructor(
    @Inject(RegistrationOrderAccess) private readonly orders: RegistrationOrderAccess,
    @Inject(Register) private readonly register: Register,
  ) {}
  async execute(
    input: { number: string; token: string; password: string; marketingConsent?: boolean },
    context: AuthContext,
  ) {
    const order = await this.orders.get(input.number, input.token, context.correlationId);
    return this.register.execute({
      input: {
        email: order.email,
        firstName: order.firstName,
        lastName: order.lastName,
        phone: order.phone,
        password: input.password,
        marketingConsent: input.marketingConsent ?? false,
      },
      context,
    });
  }
}
