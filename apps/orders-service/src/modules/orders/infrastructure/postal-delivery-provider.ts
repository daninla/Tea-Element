import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type {
  DeliveryCarrier,
  DeliveryCity,
  DeliveryPoint,
  DeliverySelection,
} from '@tea/contracts';
import { DeliveryProvider, type Parcel } from '../domain/delivery-provider';
import { OrderError } from '../domain/order-store';

const row = z.record(z.unknown());
type Row = z.infer<typeof row>;
const uuid = z.string().uuid();
const postcode = /^\d{5}$/;
function text(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}
function unavailable(): never {
  throw new OrderError('DELIVERY_UNAVAILABLE', 'Delivery tariff or directory unavailable', 503);
}
function money(value: unknown) {
  const amount = text(value);
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(amount)) return unavailable();
  const [whole, cents = ''] = amount.split('.');
  return Number(whole) * 100 + Number(cents.padEnd(2, '0'));
}
function endpoint(path: string, params: Record<string, string>) {
  return 'https://www.ukrposhta.ua/' + path + '?' + new URLSearchParams(params);
}
@Injectable()
export class PostalDeliveryProvider extends DeliveryProvider {
  available(): DeliveryCarrier[] {
    const env = process.env;
    return [
      ...(env.NOVA_POSHTA_API_KEY &&
      (uuid.safeParse(env.NOVA_POSHTA_SENDER_CITY_REF).success ||
        (!!env.NOVA_POSHTA_SENDER_CITY && /^\d{1,6}$/.test(env.NOVA_POSHTA_SENDER_BRANCH ?? '')))
        ? ['NOVA_POSHTA' as const]
        : []),
      ...(env.UKRPOSHTA_BEARER &&
      env.UKRPOSHTA_TOKEN &&
      postcode.test(env.UKRPOSHTA_SENDER_POSTCODE ?? '')
        ? ['UKRPOSHTA' as const]
        : []),
    ];
  }

  private async request(url: string, init: RequestInit) {
    try {
      const response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(2200),
      });
      if (!response.ok) return unavailable();
      return row.parse(await response.json());
    } catch {
      return unavailable();
    }
  }
  private async nova(
    modelName: string,
    calledMethod: string,
    methodProperties: Record<string, unknown>,
  ) {
    const result = await this.request('https://api.novaposhta.ua/v2.0/json/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        apiKey: process.env.NOVA_POSHTA_API_KEY,
        modelName,
        calledMethod,
        methodProperties,
      }),
    });
    if (result.success !== true) return unavailable();
    return z.array(row).parse(result.data);
  }
  private ukHeaders() {
    return { accept: 'application/json', authorization: 'Bearer ' + process.env.UKRPOSHTA_BEARER };
  }
  private async ukDirectory(action: string, params: Record<string, string>) {
    const result = await this.request(endpoint('address-classifier-ws/' + action, params), {
      headers: this.ukHeaders(),
    });
    if (result.Entries == null) return [];
    const entry = row.parse(result.Entries).Entry;
    return entry == null ? [] : z.array(row).parse(Array.isArray(entry) ? entry : [entry]);
  }
  async regions(): Promise<DeliveryCity[]> {
    if (!this.available().includes('UKRPOSHTA')) return unavailable();
    return (await this.ukDirectory('get_regions_by_region_ua', {}))
      .map((x) => ({ id: text(x.REGION_ID), name: text(x.REGION_UA) }))
      .filter((x) => /^\d{1,12}$/.test(x.id) && x.name);
  }
  async cities(
    carrier: DeliveryCarrier,
    query: string,
    regionId?: string,
  ): Promise<DeliveryCity[]> {
    if (!this.available().includes(carrier)) return unavailable();
    if (carrier === 'UKRPOSHTA' && !regionId)
      throw new OrderError('INVALID_DELIVERY_POINT', 'Select a region', 400);
    const source =
      carrier === 'NOVA_POSHTA'
        ? await this.nova('Address', 'getCities', { FindByString: query, Limit: '20', Page: '1' })
        : await this.ukDirectory('get_city_by_region_id_and_district_id_and_city_ua', {
            city_ua: query,
            region_id: regionId!,
          });
    return source
      .map((x) =>
        carrier === 'NOVA_POSHTA'
          ? {
              id: text(x.Ref),
              name: [text(x.Description), text(x.AreaDescription)].filter(Boolean).join(' · '),
            }
          : {
              id: text(x.REGION_ID) + ':' + text(x.CITY_ID),
              name: [text(x.CITY_UA), text(x.REGION_UA), text(x.DISTRICT_UA)]
                .filter(Boolean)
                .join(' · '),
            },
      )
      .filter((x) => x.id && x.name)
      .slice(0, 20);
  }
  private point(carrier: DeliveryCarrier, x: Row): DeliveryPoint {
    if (carrier === 'NOVA_POSHTA') {
      return {
        id: text(x.Ref),
        number: text(x.Number),
        address: text(x.Description),
        kind:
          text(x.CategoryOfWarehouse) === 'Postomat' || /поштомат/i.test(text(x.Description))
            ? 'LOCKER'
            : 'BRANCH',
      };
    }
    return {
      id: text(x.ID),
      number: text(x.PO_SHORT) || text(x.POSTINDEX),
      address: [text(x.ADDRESS), text(x.POSTINDEX)].filter(Boolean).join(' · '),
      kind: /поштомат/i.test([text(x.TYPE_SHORT), text(x.PO_LONG), text(x.PO_SHORT)].join(' '))
        ? 'LOCKER'
        : 'BRANCH',
    };
  }
  private async pointRows(
    carrier: DeliveryCarrier,
    cityId: string,
    query?: string,
    pointId?: string,
    page = 1,
  ) {
    if (!this.available().includes(carrier)) return unavailable();
    if (
      carrier === 'NOVA_POSHTA'
        ? !uuid.safeParse(cityId).success
        : !/^\d{1,12}:\d{1,12}$/.test(cityId)
    )
      throw new OrderError('INVALID_DELIVERY_POINT', 'Invalid city', 400);
    if (carrier === 'NOVA_POSHTA')
      return this.nova('AddressGeneral', 'getWarehouses', {
        CityRef: cityId,
        ...(pointId ? { Ref: pointId } : query ? { FindByString: query } : {}),
        Limit: 100,
        Page: page,
      });
    const [region, locality] = cityId.split(':') as [string, string];
    return (
      await this.ukDirectory('get_postoffices_by_city_id', { region_id: region, city_id: locality })
    ).filter(
      (x) =>
        text(x.REGION_ID) === region &&
        text(x.CITY_ID) === locality &&
        text(x.LOCK_CODE) === '0' &&
        text(x.IS_SECURITY) !== '1',
    );
  }
  private readonly novaPoints = new Map<string, { row: Row; expiresAt: number }>();

  async points(carrier: DeliveryCarrier, cityId: string, query?: string, page = 1) {
    const search = query?.replace(/^(?:(?:відділення|поштомат)\s*)?№?\s*(\d+)$/iu, '$1');
    const rows = await this.pointRows(carrier, cityId, search, undefined, page);
    const start = carrier === 'UKRPOSHTA' ? (page - 1) * 100 : 0;
    const points = rows
      .map((row) => ({ row, point: this.point(carrier, row) }))
      .filter(
        ({ point }) =>
          point.id &&
          point.number &&
          point.address &&
          (carrier === 'NOVA_POSHTA' ||
            !search ||
            (point.number + ' ' + point.address).toLowerCase().includes(search.toLowerCase())),
      )
      .sort(
        (a, b) =>
          Number(b.point.number === search) - Number(a.point.number === search) ||
          a.point.number.localeCompare(b.point.number, 'uk', { numeric: true }),
      )
      .slice(start, start + 100);
    if (carrier === 'NOVA_POSHTA') {
      for (const { row, point } of points) {
        if (text(row.CityRef) !== cityId) continue;
        if (this.novaPoints.size >= 500)
          this.novaPoints.delete(this.novaPoints.keys().next().value!);
        this.novaPoints.set(cityId + ':' + point.id, { row, expiresAt: Date.now() + 60_000 });
      }
    }
    return points.map(({ point }) => point);
  }
  private senderCity?: { ref: string; expiresAt: number };

  private async novaSenderCity() {
    const explicit = uuid.safeParse(process.env.NOVA_POSHTA_SENDER_CITY_REF);
    if (explicit.success) return explicit.data;
    if (this.senderCity && this.senderCity.expiresAt > Date.now()) return this.senderCity.ref;
    const city = process.env.NOVA_POSHTA_SENDER_CITY!;
    const branch = process.env.NOVA_POSHTA_SENDER_BRANCH!;
    const rows = await this.nova('AddressGeneral', 'getWarehouses', {
      CityName: city,
      FindByString: branch,
      Limit: 100,
      Page: 1,
    });
    const matches = rows.filter(
      (x) =>
        text(x.CityDescription).toLowerCase() === city.toLowerCase() &&
        text(x.Number) === branch &&
        this.point('NOVA_POSHTA', x).kind === 'BRANCH',
    );
    const ref = uuid.safeParse(matches[0]?.CityRef);
    if (matches.length !== 1 || !ref.success) return unavailable();
    this.senderCity = { ref: ref.data, expiresAt: Date.now() + 60 * 60 * 1000 };
    return ref.data;
  }

  async rate(selection: DeliverySelection, parcel: Parcel) {
    const { carrier, cityId, pointId } = selection;
    const cached =
      carrier === 'NOVA_POSHTA' && this.available().includes(carrier)
        ? this.novaPoints.get(cityId + ':' + pointId)
        : undefined;
    const [rows, senderCity] = await Promise.all([
      cached && cached.expiresAt > Date.now()
        ? [cached.row]
        : this.pointRows(carrier, cityId, undefined, pointId),
      carrier === 'NOVA_POSHTA' && this.available().includes(carrier)
        ? this.novaSenderCity()
        : undefined,
    ]);
    const destination = rows.find(
      (x) =>
        this.point(carrier, x).id === pointId &&
        (carrier !== 'NOVA_POSHTA' || text(x.CityRef) === cityId),
    );
    if (!destination)
      throw new OrderError('INVALID_DELIVERY_POINT', 'Select an available delivery point', 400);
    const point = this.point(carrier, destination);
    const env = process.env;
    let fee: number;
    if (carrier === 'NOVA_POSHTA') {
      const [price] = await this.nova('InternetDocument', 'getDocumentPrice', {
        CitySender: senderCity,
        CityRecipient: cityId,
        ServiceType: 'WarehouseWarehouse',
        CargoType: 'Parcel',
        SeatsAmount: 1,
        Weight: parcel.weight / 1000,
        ...(!parcel.branchPacking && {
          VolumeGeneral: (parcel.length * parcel.width * parcel.height) / 1_000_000,
        }),
        Cost: parcel.value / 100,
      });
      // Standard NovaPay transfer tariff (2% + UAH 20). Prefer the standard
      // estimate because the buyer's payment instrument is unknown at checkout.
      fee =
        money(price?.Cost) +
        (parcel.cod ? Math.round((parcel.value * 2) / 100) + 2000 : 0) +
        (point.kind === 'LOCKER' ? 1000 : 0) +
        (parcel.branchPacking ? 1500 : 0);
    } else {
      const to = text(destination.POSTINDEX);
      if (!postcode.test(to)) return unavailable();
      if (parcel.branchPacking) return unavailable();
      const { value, cod, weight, length, width, height } = parcel;
      const dimensions = { weight, length, width, height };
      const quoted = await this.request(
        endpoint('ecom/0.0.1/domestic/delivery-price', { token: env.UKRPOSHTA_TOKEN! }),
        {
          method: 'POST',
          headers: { ...this.ukHeaders(), 'content-type': 'application/json' },
          body: JSON.stringify({
            sender: { postcode: env.UKRPOSHTA_SENDER_POSTCODE },
            recipient: { postcode: to },
            type: 'EXPRESS',
            deliveryType: 'W2W',
            ...dimensions,
            parcels: [dimensions],
            declaredPrice: value / 100,
            ...(cod ? { postPay: value / 100 } : {}),
          }),
        },
      );
      fee = money(quoted.deliveryPrice) + (cod ? money(quoted.postPayDeliveryPrice) : 0);
    }
    const city = text(
      carrier === 'NOVA_POSHTA' ? destination.CityDescription : destination.CITY_UA,
    );
    if (!city || !point.address) return unavailable();
    return {
      fee,
      city,
      address: carrier === 'UKRPOSHTA' ? point.number + ' · ' + point.address : point.address,
    };
  }
}
