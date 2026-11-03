import { ListCategories } from './list-categories';
import { repository } from '../../../../test/catalog-fixtures';
describe('ListCategories', () => {
  it('returns repository categories without requiring a customer identity', async () => {
    const d = repository();
    d.methods.categories.mockResolvedValue([{ slug: 'oolong' }]);
    expect(await new ListCategories(d.repository).execute()).toEqual([{ slug: 'oolong' }]);
  });
});
