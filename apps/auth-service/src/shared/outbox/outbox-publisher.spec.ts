import { OutboxPublisher } from './outbox-publisher';
import { PrismaService } from '../prisma.service';
import { RabbitEventBus } from './rabbit-event-bus';
describe('OutboxPublisher', () => {
  it.each([true, false])('marks delivered only after broker confirmation: %s', async (success) => {
    const update = jest.fn().mockResolvedValue({});
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'event' }]),
      outbox: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'event', payload: {}, attempts: 2 }),
        update,
      },
    };
    const db = {
      $transaction: (fn: (client: typeof tx) => Promise<void>) => fn(tx),
    } as unknown as PrismaService;
    const bus = {
      publish: jest
        .fn()
        .mockImplementation(() =>
          success ? Promise.resolve() : Promise.reject(new Error('broker offline')),
        ),
    } as unknown as RabbitEventBus;
    await new OutboxPublisher(db, bus).flush();
    const data = update.mock.calls[0]![0].data;
    if (success) expect(data.publishedAt).toBeInstanceOf(Date);
    else {
      expect(data).not.toHaveProperty('publishedAt');
      expect(data.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    }
  });
});
