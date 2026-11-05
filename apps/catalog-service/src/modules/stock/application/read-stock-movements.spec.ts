import { ReadStockMovements } from './read-stock-movements';
import type { StockStore } from '../domain/stock-store';
it('keeps pagination and order scope and propagates storage failure', async () => {
  const movements = jest.fn().mockRejectedValue(new Error('unavailable'));
  await expect(
    new ReadStockMovements({ movements } as unknown as StockStore).execute('order', 2),
  ).rejects.toThrow('unavailable');
  expect(movements).toHaveBeenCalledWith('order', 2);
});
