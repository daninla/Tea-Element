import { Inject, Injectable } from '@nestjs/common';
import type { AccountCustomerQuery } from '@tea/contracts';
import { CustomerAccountsStore } from '../domain/customer-accounts-store';
@Injectable()
export class ReadCustomerAccounts {
  constructor(@Inject(CustomerAccountsStore) private readonly store: CustomerAccountsStore) {}
  execute(input: AccountCustomerQuery, actorId: string) {
    return this.store.read(input, actorId);
  }
}
