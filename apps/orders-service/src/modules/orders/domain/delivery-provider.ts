import type {
  DeliveryCarrier,
  DeliveryCity,
  DeliveryPoint,
  DeliverySelection,
} from '@tea/contracts';

export interface Parcel {
  weight: number;
  length: number;
  width: number;
  height: number;
  value: number;
  cod: boolean;
}

export abstract class DeliveryProvider {
  abstract available(): DeliveryCarrier[];
  abstract regions(): Promise<DeliveryCity[]>;
  abstract cities(
    carrier: DeliveryCarrier,
    query: string,
    regionId?: string,
  ): Promise<DeliveryCity[]>;
  abstract points(
    carrier: DeliveryCarrier,
    cityId: string,
    query?: string,
  ): Promise<DeliveryPoint[]>;
  abstract rate(
    selection: DeliverySelection,
    parcel: Parcel,
  ): Promise<{ fee: number; city: string; address: string }>;
}
