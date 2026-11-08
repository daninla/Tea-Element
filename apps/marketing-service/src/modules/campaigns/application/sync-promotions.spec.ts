import { SyncPromotions } from './sync-promotions';
import { CampaignStore, PromotionSource } from '../domain/campaign-store';
test('does not fetch promotions while disabled and bounds paginated work', async () => {
  const enabled = jest.fn().mockResolvedValue(false),
    syncPromotions = jest.fn(),
    list = jest.fn().mockResolvedValue({ items: [], nextCursor: 'next' });
  const sync = new SyncPromotions(
    { enabled, syncPromotions } as unknown as CampaignStore,
    { list } as unknown as PromotionSource,
  );
  await sync.execute();
  expect(list).not.toHaveBeenCalled();
  enabled.mockResolvedValue(true);
  await sync.execute();
  expect(list).toHaveBeenCalledTimes(5);
  list.mockResolvedValueOnce({ items: [], nextCursor: null });
  await sync.execute();
  expect(list).toHaveBeenLastCalledWith('next');
  await sync.execute();
  expect(list.mock.calls[6]).toEqual([undefined]);
});
test('source failures stop a campaign pass rather than using stale promotions', async () => {
  const syncPromotions = jest.fn(),
    list = jest.fn().mockRejectedValue(new Error('offline'));
  const sync = new SyncPromotions(
    { enabled: async () => true, syncPromotions } as unknown as CampaignStore,
    { list } as unknown as PromotionSource,
  );
  await expect(sync.execute()).rejects.toThrow('offline');
  expect(syncPromotions).not.toHaveBeenCalled();
});
