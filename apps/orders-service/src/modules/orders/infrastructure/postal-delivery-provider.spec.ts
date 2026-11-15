import { PostalDeliveryProvider } from './postal-delivery-provider';

const sender = '11111111-1111-4111-8111-111111111111';
const recipient = '22222222-2222-4222-8222-222222222222';
const point = '33333333-3333-4333-8333-333333333333';
const parcel = { weight: 700, length: 22, width: 15, height: 10, value: 12000, cod: true };
const env = process.env;
afterEach(() => {
  process.env = env;
  jest.restoreAllMocks();
});

it('resolves Zaporizhzhia branch 19 and adds the locker and collect-on-delivery fees', async () => {
  process.env = {
    ...env,
    NOVA_POSHTA_API_KEY: 'fixture',
    NOVA_POSHTA_SENDER_CITY: 'Запоріжжя',
    NOVA_POSHTA_SENDER_BRANCH: '19',
    NOVA_POSHTA_SENDER_CITY_REF: '',
  };
  const fetcher = jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    const { calledMethod, methodProperties } = JSON.parse(String(init?.body));
    if (calledMethod === 'getDocumentPrice') {
      expect(methodProperties).toMatchObject({
        CitySender: sender,
        CityRecipient: recipient,
        Weight: expect.any(Number),
        Cost: 120,
      });
      if (methodProperties.Weight === 1)
        expect(methodProperties).not.toHaveProperty('VolumeGeneral');
      return Response.json({ success: true, data: [{ Cost: '80.50' }] });
    }
    if (methodProperties.CityName) {
      expect(methodProperties).toMatchObject({ CityName: 'Запоріжжя', FindByString: '19' });
      return Response.json({
        success: true,
        data: [
          {
            CityDescription: 'Запоріжжя',
            CityRef: sender,
            Number: '19',
            Description: 'Відділення №19',
          },
          {
            CityDescription: 'Запоріжжя',
            CityRef: sender,
            Number: '119',
            Description: 'Відділення №119',
          },
        ],
      });
    }
    expect(methodProperties).toMatchObject({ CityRef: recipient, Ref: point });
    return Response.json({
      success: true,
      data: [
        {
          Ref: point,
          CityRef: recipient,
          CityDescription: 'Київ',
          Number: '20',
          Description: 'Поштомат №20',
        },
      ],
    });
  });
  const provider = new PostalDeliveryProvider();
  const selection = { carrier: 'NOVA_POSHTA' as const, cityId: recipient, pointId: point };
  await expect(provider.rate(selection, parcel)).resolves.toEqual({
    city: 'Київ',
    address: 'Поштомат №20',
    fee: 11290,
  });
  await expect(provider.rate(selection, { ...parcel, cod: false })).resolves.toMatchObject({
    fee: 9050,
  });
  await expect(
    provider.rate(selection, { weight: 1000, value: 12000, cod: true, branchPacking: true }),
  ).resolves.toMatchObject({ fee: 12790 });
  const tariff = JSON.parse(String(fetcher.mock.calls.at(-1)?.[1]?.body));
  expect(tariff.methodProperties.Weight).toBe(1);
  expect(fetcher).toHaveBeenCalledTimes(7);
});

it('uses the string pagination required by the live Nova Poshta city API', async () => {
  process.env = { ...env, NOVA_POSHTA_API_KEY: 'fixture', NOVA_POSHTA_SENDER_CITY_REF: sender };
  jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
    expect(JSON.parse(String(init?.body))).toMatchObject({
      calledMethod: 'getCities',
      methodProperties: { FindByString: 'Київ', Page: '1', Limit: '20' },
    });
    return Response.json({ success: true, data: [{ Ref: recipient, Description: 'Київ' }] });
  });
  await expect(new PostalDeliveryProvider().cities('NOVA_POSHTA', 'Київ')).resolves.toEqual([
    { id: recipient, name: 'Київ' },
  ]);
});

it('quotes Ukrposhta using the selected postcode, without treating its card terminal as a locker', async () => {
  process.env = {
    ...env,
    UKRPOSHTA_BEARER: 'fixture',
    UKRPOSHTA_TOKEN: 'fixture',
    UKRPOSHTA_SENDER_POSTCODE: '69000',
  };
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/domestic/delivery-price')) {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        sender: { postcode: '69000' },
        recipient: { postcode: '01010' },
        postPay: 120,
      });
      return Response.json({ deliveryPrice: 50, postPayDeliveryPrice: 12 });
    }
    expect(url.searchParams.get('region_id')).toBe('286');
    expect(url.searchParams.get('city_id')).toBe('29713');
    return Response.json({
      Entries: {
        Entry: [
          {
            ID: '2699',
            CITY_ID: '29713',
            REGION_ID: '286',
            LOCK_CODE: '0',
            POSTTERMINAL: '1',
            CITY_UA: 'Київ',
            PO_SHORT: 'Київ 10',
            ADDRESS: 'пров. Іподромний, 5',
            POSTINDEX: '01010',
          },
        ],
      },
    });
  });
  const provider = new PostalDeliveryProvider();
  const cityId = '286:29713';
  await expect(provider.points('UKRPOSHTA', cityId)).resolves.toMatchObject([
    { id: '2699', kind: 'BRANCH' },
  ]);
  await expect(
    provider.rate({ carrier: 'UKRPOSHTA', cityId, pointId: '2699' }, parcel),
  ).resolves.toMatchObject({ fee: 6200 });
  await expect(
    provider.rate({ carrier: 'UKRPOSHTA', cityId, pointId: 'other' }, parcel),
  ).rejects.toMatchObject({ code: 'INVALID_DELIVERY_POINT' });
});
