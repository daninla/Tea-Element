import { ListProducts } from './list-products';
import { repository } from '../../../../test/catalog-fixtures';
describe('ListProducts', () => {
  it('applies bounded defaults and maps prices and availability', async () => {
    const d = repository();
    const page = await new ListProducts(d.repository).execute({});
    expect(d.methods.list).toHaveBeenCalledWith(
      { page: 1, pageSize: 12, sort: 'newest' },
      expect.any(Date),
    );
    expect(page.totalPages).toBe(1);
    expect(page.items[0]?.variants[1]?.inStock).toBe(false);
  });
  it('rejects an inverted price range before querying persistence', async () => {
    const d = repository();
    await expect(
      new ListProducts(d.repository).execute({ minPrice: 100, maxPrice: 50 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(d.methods.list).not.toHaveBeenCalled();
  });
  it('preserves total on a page beyond the end and returns zero pages for an empty catalog', async () => {
    const d = repository();
    d.methods.list
      .mockResolvedValueOnce({ products: [], total: 13 })
      .mockResolvedValueOnce({ products: [], total: 0 });
    expect(await new ListProducts(d.repository).execute({ page: 99, pageSize: 12 })).toMatchObject({
      items: [],
      total: 13,
      totalPages: 2,
    });
    expect((await new ListProducts(d.repository).execute({})).totalPages).toBe(0);
  });
});
