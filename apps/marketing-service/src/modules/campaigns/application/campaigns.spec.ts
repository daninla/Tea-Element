import { RunCampaigns } from './run-campaigns';
import { HandleMarketingEvent } from './handle-marketing-event';
import { UnsubscribeMarketing } from './unsubscribe-marketing';
import type { CampaignStore } from '../domain/campaign-store';
it('schedules before delivering a bounded batch with the same clock', async () => {
  const store = { schedule: jest.fn(), deliver: jest.fn().mockResolvedValue(true) },
    now = new Date();
  await new RunCampaigns(store as unknown as CampaignStore).execute(now);
  expect(store.schedule).toHaveBeenCalledWith(now);
  expect(store.deliver).toHaveBeenCalledTimes(10);
});
it('passes events through and propagates projection errors for broker retry', async () => {
  const ingest = jest.fn().mockRejectedValue(new Error('retry')),
    event = { eventId: 'event' };
  await expect(
    new HandleMarketingEvent({ ingest } as unknown as CampaignStore).execute(event as never),
  ).rejects.toThrow('retry');
  expect(ingest).toHaveBeenCalledWith(event);
});
it('does not replace the verified unsubscribe token with an email-based operation', async () => {
  const unsubscribe = jest.fn();
  await new UnsubscribeMarketing({ unsubscribe } as unknown as CampaignStore).execute('bearer');
  expect(unsubscribe).toHaveBeenCalledWith('bearer');
});
