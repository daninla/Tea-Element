import type {
  DeliveryCarrier,
  DeliveryCity,
  DeliveryPoint,
  DeliveryQuote,
  DeliveryRequest,
} from '@tea/contracts';
import { request } from './orders';

function delivery<T>(input: DeliveryRequest) {
  return request<T>('/orders/delivery', 'POST', input);
}
export const checkoutDeliveryApi = {
  cities: (carrier: DeliveryCarrier, query: string, regionId?: string) =>
    delivery<DeliveryCity[]>({ kind: 'CITIES', carrier, query, regionId }),
  points: (carrier: DeliveryCarrier, cityId: string, query: string, page: number) =>
    delivery<DeliveryPoint[]>({ kind: 'POINTS', carrier, cityId, query, page }),
  quote: (input: Omit<Extract<DeliveryRequest, { kind: 'QUOTE' }>, 'kind'>) =>
    delivery<DeliveryQuote>({ kind: 'QUOTE', ...input }),
};
