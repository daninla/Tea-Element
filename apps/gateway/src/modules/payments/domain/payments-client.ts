import type { OrdersRequest, OrdersResult } from '@tea/contracts';
export abstract class PaymentsClient {
  abstract request<T>(pattern: string, request: OrdersRequest<unknown>): Promise<OrdersResult<T>>;
}
