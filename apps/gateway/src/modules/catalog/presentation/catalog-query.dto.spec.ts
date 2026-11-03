import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CatalogQueryDto } from './catalog-query.dto';
describe('catalog query validation', () => {
  it('parses false as false and only decimal integers as numbers', () => {
    const dto = plainToInstance(CatalogQueryDto, {
      onSale: 'false',
      inStock: 'true',
      page: '2',
      minPrice: '0',
    });
    expect(dto.onSale).toBe(false);
    expect(dto.inStock).toBe(true);
    expect(dto.page).toBe(2);
    expect(validateSync(dto)).toHaveLength(0);
  });
  it.each([
    { page: '1e3' },
    { page: '0' },
    { pageSize: '49' },
    { onSale: 'yes' },
    { q: ['x', 'y'] },
    { minPrice: '' },
    { minPrice: '1.5' },
    { sort: 'unsafe' },
  ])('rejects malformed query %j', (query) => {
    expect(validateSync(plainToInstance(CatalogQueryDto, query)).length).toBeGreaterThan(0);
  });
});
