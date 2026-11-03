import { CreateOrder } from './create-order';
import type { CreateOrderInput, CartQuote, CreatedOrder } from '@tea/contracts';
import type { OrderStore, QuoteProvider } from '../domain/order-store';
describe('CreateOrder', () => {
  const input = { items: [{ variantId: 'v', quantity: 1 }] } as CreateOrderInput;
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
