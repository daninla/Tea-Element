import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import {
  EVENTS_EXCHANGE,
  EVENTS_DLX,
  MARKETING_REGISTRATION_QUEUE,
  USER_REGISTERED_ROUTING_KEY,
  type UserRegistered,
} from '@tea/contracts';
import { readEnvironment } from '../../config/environment';
@Injectable()
export class RabbitEventBus implements OnModuleDestroy {
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  async publish(event: UserRegistered) {
    const namespace = readEnvironment().EVENTS_NAMESPACE;
    const exchange = namespace === 'tea' ? EVENTS_EXCHANGE : `${namespace}.events`;
    const dlx = namespace === 'tea' ? EVENTS_DLX : `${namespace}.events.dlx`;
    const queue =
      namespace === 'tea'
        ? MARKETING_REGISTRATION_QUEUE
        : `${namespace}.${MARKETING_REGISTRATION_QUEUE}`;
    if (!this.channel) {
      await this.connection?.close().catch(() => {});
      const connection = await connect(readEnvironment().RABBITMQ_URL, { timeout: 3000 });
      this.connection = connection;
      connection.on('error', () => {
        if (this.connection === connection) this.channel = undefined;
      });
      connection.on('close', () => {
        if (this.connection === connection) {
          this.channel = undefined;
          this.connection = undefined;
        }
      });
      try {
        const channel = await connection.createConfirmChannel();
        const resetChannel = () => {
          if (this.channel === channel) this.channel = undefined;
        };
        channel.on('error', resetChannel);
        channel.on('close', resetChannel);
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.assertExchange(dlx, 'topic', { durable: true });
        await channel.assertQueue(`${queue}.dlq`, { durable: true });
        await channel.bindQueue(`${queue}.dlq`, dlx, USER_REGISTERED_ROUTING_KEY);
        // Bind before the first publication: registrations survive until marketing is implemented.
        await channel.assertQueue(queue, {
          durable: true,
          deadLetterExchange: dlx,
          deadLetterRoutingKey: USER_REGISTERED_ROUTING_KEY,
        });
        await channel.bindQueue(queue, exchange, USER_REGISTERED_ROUTING_KEY);
        this.channel = channel;
      } catch {
        await connection.close().catch(() => {});
        if (this.connection === connection) {
          this.connection = undefined;
          this.channel = undefined;
        }
        throw new Error('Event broker unavailable');
      }
    }
    const channel = this.channel;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Publisher confirmation timed out')), 3000);
      channel.publish(
        exchange,
        USER_REGISTERED_ROUTING_KEY,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: event.eventId,
          correlationId: event.correlationId,
        },
        (error: unknown) => {
          clearTimeout(timer);
          if (error) reject(new Error('Publication failed'));
          else resolve();
        },
      );
    });
  }
  async onModuleDestroy() {
    await this.channel?.close().catch(() => {});
    await this.connection?.close().catch(() => {});
  }
}
