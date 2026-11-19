import type { OrdersRequest } from '@tea/contracts';
export abstract class OrdersClient {
  abstract request<T>(pattern: string, request: OrdersRequest<unknown>): Promise<T>;
}
