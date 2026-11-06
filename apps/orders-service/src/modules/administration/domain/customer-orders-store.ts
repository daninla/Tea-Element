import type { OrderCustomerQuery, GuestCustomerPage, CustomerHistory } from '@tea/contracts';
export abstract class CustomerOrdersStore {
  abstract read(input: OrderCustomerQuery): Promise<GuestCustomerPage | CustomerHistory>;
}
