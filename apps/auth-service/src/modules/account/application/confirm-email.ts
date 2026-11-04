import { Inject, Injectable } from '@nestjs/common';
import { AccountStore } from '../domain/account-store';
@Injectable()
export class ConfirmEmail {
  constructor(@Inject(AccountStore) private readonly store: AccountStore) {}
  async execute(token: string, correlationId: string) {
    await this.store.confirm('VERIFY_EMAIL', token, correlationId);
    return { confirmed: true as const };
  }
}
