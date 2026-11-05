import type { InventoryStore } from '../domain/inventory-store';
import { ListInventory } from './list-inventory';
import { GetInventory } from './get-inventory';
import { ReadInventoryHistory } from './read-inventory-history';
import { RecordPurchase } from './record-purchase';
import { AdjustInventory } from './adjust-inventory';
it('propagates failed scoped reads rather than returning a partial inventory', async () => {
  const list = jest.fn().mockRejectedValue(new Error('unavailable')),
    get = jest.fn().mockRejectedValue(new Error('missing')),
    history = jest.fn().mockRejectedValue(new Error('history unavailable'));
  const store = { list, get, history } as unknown as InventoryStore;
  await expect(new ListInventory(store).execute({ page: 2, q: 'literal_%' })).rejects.toThrow(
    'unavailable',
  );
  await expect(new GetInventory(store).execute('product')).rejects.toThrow('missing');
  await expect(new ReadInventoryHistory(store).execute('product', 'PURCHASES', 2)).rejects.toThrow(
    'history unavailable',
  );
  expect(history).toHaveBeenCalledWith('product', 'PURCHASES', 2);
});
it('supplies the trusted actor separately from purchase and adjustment input', async () => {
  const purchase = jest.fn().mockRejectedValue(new Error('rollback')),
    adjust = jest.fn().mockRejectedValue(new Error('reserved'));
  const store = { purchase, adjust } as unknown as InventoryStore;
  const input = { productId: 'product', key: 'key' };
  await expect(new RecordPurchase(store).execute(input as never, 'trusted-admin')).rejects.toThrow(
    'rollback',
  );
  await expect(new AdjustInventory(store).execute(input as never, 'trusted-admin')).rejects.toThrow(
    'reserved',
  );
  expect(purchase).toHaveBeenCalledWith(input, 'trusted-admin');
  expect(adjust).toHaveBeenCalledWith(input, 'trusted-admin');
});
