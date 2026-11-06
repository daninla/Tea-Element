import type { AccountCustomerQuery, CustomerAccount, CustomerAccountPage } from '@tea/contracts';
export abstract class CustomerAccountsStore {
  abstract read(
    input: AccountCustomerQuery,
    actorId: string,
  ): Promise<CustomerAccount | CustomerAccountPage>;
}
