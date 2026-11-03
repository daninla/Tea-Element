import { ForwardCatalog } from './forward-catalog';
import { CatalogClient } from '../domain/catalog-client';
describe('ForwardCatalog', () => {
  it('returns a public result without auth-only RPC types', async () => {
    const client = {
      request: jest.fn().mockResolvedValue({ ok: true, value: [] }),
    } as unknown as CatalogClient;
    expect(
      await new ForwardCatalog(client).execute('catalog.categories', {
        input: {},
        context: { correlationId: 'test' },
      }),
    ).toEqual([]);
  });
  it('preserves a safe catalog error status', async () => {
    const client = {
      request: jest.fn().mockResolvedValue({
        ok: false,
        error: { statusCode: 404, code: 'PRODUCT_NOT_FOUND', message: 'Product not found' },
      }),
    } as unknown as CatalogClient;
    await expect(
      new ForwardCatalog(client).execute('catalog.product', {
        input: {},
        context: { correlationId: 'test' },
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
