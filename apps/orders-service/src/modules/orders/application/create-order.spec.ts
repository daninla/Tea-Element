import { CreateOrder } from './create-order';
import type { CreateOrderInput, CartQuote, CreatedOrder } from '@tea/contracts';
import type { CheckoutDelivery } from './checkout-delivery';
import type { OrderStore, QuoteProvider } from '../domain/order-store';
describe('CreateOrder', () => {
  const input = {
    items: [{ variantId: 'v', quantity: 1 }],
    delivery: { method: 'PICKUP', city: '', address: '' },
  } as CreateOrderInput;
  const context = { idempotencyKey: 'key', correlationId: 'correlation' };
  const created = { order: { number: 'one' }, accessToken: 'token' } as CreatedOrder;
  const quote = {
    items: [
      {
        variantId: 'v',
        quantity: 1,
        inStock: true,
        unitPrice: 99,
        originalPrice: 99,
        productId: 'p',
        slug: 'tea',
        name: 'Tea',
        weightGrams: 25,
      },
    ],
    unavailableVariantIds: [],
    total: 99,
    subtotal: 99,
    discount: 0,
  } as CartQuote;
  it('replays after a lost response even if catalog is down', async () => {
    const store = { replay: jest.fn().mockResolvedValue(created) };
    const catalog = { quote: jest.fn() };
    expect(
      await new CreateOrder(store as unknown as OrderStore, catalog as QuoteProvider).execute(
        input,
        context,
      ),
    ).toBe(created);
    expect(catalog.quote).not.toHaveBeenCalled();
  });
  it('persists only a fresh server quote', async () => {
    const store = {
      replay: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };
    const catalog = { quote: jest.fn().mockResolvedValue(quote) };
    await new CreateOrder(store as unknown as OrderStore, catalog).execute(input, context);
    expect(store.create).toHaveBeenCalledWith(input, context, quote);
  });
  it('rejects a changed delivery-inclusive total before saving the order', async () => {
    const store = { replay: jest.fn().mockResolvedValue(null), create: jest.fn() };
    const catalog = { quote: jest.fn().mockResolvedValue(quote) };
    const rate = { fee: 100, city: 'Київ', address: 'Відділення №1' };
    const delivery = { rate: jest.fn().mockResolvedValue(rate) } as unknown as CheckoutDelivery;
    const useCase = new CreateOrder(store as unknown as OrderStore, catalog, delivery);
    const selected = {
      ...input,
      delivery: {
        ...input.delivery,
        method: 'CARRIER_POINT' as const,
        selection: {
          carrier: 'NOVA_POSHTA' as const,
          cityId: 'city',
          pointId: 'point',
        },
      },
      expectedDeliveryTotal: 198,
    };
    await expect(useCase.execute(selected, context)).rejects.toMatchObject({
      code: 'DELIVERY_PRICE_CHANGED',
    });
    expect(store.create).not.toHaveBeenCalled();
    const accepted = { ...selected, expectedDeliveryTotal: 199 };
    await useCase.execute(accepted, context);
    expect(store.create).toHaveBeenCalledWith(accepted, context, quote, rate);
  });
  it('does not persist on missing stock', async () => {
    const store = { replay: jest.fn().mockResolvedValue(null), create: jest.fn() };
    const catalog = {
      quote: jest
        .fn()
        .mockResolvedValue({ ...quote, items: [{ ...quote.items[0], inStock: false }] }),
    };
    await expect(
      new CreateOrder(store as unknown as OrderStore, catalog).execute(input, context),
    ).rejects.toThrow();
    expect(store.create).not.toHaveBeenCalled();
  });
});
