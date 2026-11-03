import { EventEmitter } from 'node:events';
import { connect } from 'amqplib';
import type { UserRegistered } from '@tea/contracts';
import { RabbitEventBus } from './rabbit-event-bus';
jest.mock('amqplib', () => ({ connect: jest.fn() }));
const event: UserRegistered = {
  eventId: 'event',
  name: 'UserRegistered',
  version: 1,
  occurredAt: new Date().toISOString(),
  correlationId: 'test',
  payload: {
    userId: 'user',
    email: 'test@example.test',
    firstName: 'Tea',
    lastName: 'Buyer',
    marketingConsent: false,
  },
};
function transport() {
  const channel = Object.assign(new EventEmitter(), {
    assertExchange: jest.fn().mockResolvedValue(undefined),
    assertQueue: jest.fn().mockResolvedValue(undefined),
    bindQueue: jest.fn().mockResolvedValue(undefined),
    publish: jest
      .fn()
      .mockImplementation((_exchange, _key, _body, _options, callback: (error: null) => void) => {
        callback(null);
        return true;
      }),
    close: jest.fn().mockResolvedValue(undefined),
  });
  const connection = Object.assign(new EventEmitter(), {
    createConfirmChannel: jest.fn().mockResolvedValue(channel),
    close: jest.fn().mockResolvedValue(undefined),
  });
  return { channel, connection };
}
describe('RabbitEventBus recovery', () => {
  it('reconnects after a channel closes without an error event', async () => {
    const first = transport();
    const second = transport();
    jest
      .mocked(connect)
      .mockResolvedValueOnce(first.connection as never)
      .mockResolvedValueOnce(second.connection as never);
    const bus = new RabbitEventBus();
    await bus.publish(event);
    first.channel.emit('close');
    await bus.publish(event);
    expect(first.connection.close).toHaveBeenCalled();
    expect(second.channel.publish).toHaveBeenCalled();
    await bus.onModuleDestroy();
  });
  it('closes a connection when topology initialization fails', async () => {
    const first = transport();
    first.channel.assertQueue.mockRejectedValueOnce(new Error('queue unavailable'));
    const second = transport();
    jest
      .mocked(connect)
      .mockResolvedValueOnce(first.connection as never)
      .mockResolvedValueOnce(second.connection as never);
    const bus = new RabbitEventBus();
    await expect(bus.publish(event)).rejects.toThrow('Event broker unavailable');
    expect(first.connection.close).toHaveBeenCalled();
    await bus.publish(event);
    expect(second.channel.publish).toHaveBeenCalled();
    await bus.onModuleDestroy();
  });
});
