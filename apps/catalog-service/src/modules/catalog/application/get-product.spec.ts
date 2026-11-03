import { GetProduct } from './get-product';
import { repository } from '../../../../test/catalog-fixtures';
describe('GetProduct', () => {
  it('returns only public product data', async () => {
    const d = repository();
    const view = await new GetProduct(d.repository).execute('test-tea');
    expect(view.slug).toBe('test-tea');
    expect(view).not.toHaveProperty('promotions');
    expect(view).not.toHaveProperty('inventory');
  });
  it('returns the same 404 for unknown and hidden products', async () => {
    const d = repository();
    d.methods.bySlug.mockResolvedValue(null);
    await expect(new GetProduct(d.repository).execute('hidden')).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });
});
