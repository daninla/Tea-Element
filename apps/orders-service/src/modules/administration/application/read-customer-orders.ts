import { Inject, Injectable } from '@nestjs/common';
import type { OrderCustomerQuery } from '@tea/contracts';
import { CustomerOrdersStore } from '../domain/customer-orders-store';
@Injectable()
export class ReadCustomerOrders {
  constructor(@Inject(CustomerOrdersStore) private readonly store: CustomerOrdersStore) {}
  execute(input: OrderCustomerQuery) {
    return this.store.read(input);
  }
}
