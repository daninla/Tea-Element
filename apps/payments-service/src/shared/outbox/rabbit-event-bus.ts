import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { connect, type ChannelModel, type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import {
  checkoutRoutingKey,
  CHECKOUT_ROUTES,
  CHECKOUT_SUBSCRIPTIONS,
  type CheckoutEvent,
} from '@tea/contracts';
import { readEnvironment } from '../../config/environment';
@Injectable()
export class RabbitEventBus implements OnModuleDestroy {
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private connecting?: Promise<ConfirmChannel>;
  private readonly subscriptions = new Map<string, (event: unknown) => Promise<void>>();
  private stopping = false;
  private get prefix() {
    const ns = readEnvironment().EVENTS_NAMESPACE;
    return ns === 'tea' ? '' : `${ns}.`;
  }
  private get exchange() {
    return `${readEnvironment().EVENTS_NAMESPACE}.events`;
  }
  private async open(): Promise<ConfirmChannel> {
    if (this.channel) return this.channel;
    if (this.connecting) return this.connecting;
    this.connecting = this.connect().finally(() => {
      this.connecting = undefined;
    });
    return this.connecting;
  }
  private async connect() {
    await this.connection?.close().catch(() => {});
    const connection = await connect(readEnvironment().RABBITMQ_URL, { timeout: 3000 });
    this.connection = connection;
    connection.on('error', () => {});
    connection.on('close', () => {
      if (this.connection === connection) {
        this.channel = undefined;
        this.connection = undefined;
      }
    });
    const channel = await connection.createConfirmChannel();
    channel.on('error', () => {});
    channel.on('close', () => {
      if (this.channel === channel) this.channel = undefined;
    });
    const dlx = `${this.exchange}.dlx`;
    await channel.assertExchange(this.exchange, 'topic', { durable: true });
    await channel.assertExchange(dlx, 'topic', { durable: true });
    for (const [base, name] of CHECKOUT_SUBSCRIPTIONS) {
      const queue = this.prefix + base;
      const key = CHECKOUT_ROUTES[name];
      await channel.assertQueue(`${queue}.dlq`, { durable: true });
      await channel.bindQueue(`${queue}.dlq`, dlx, key);
      await channel.assertQueue(queue, {
        durable: true,
        deadLetterExchange: dlx,
        deadLetterRoutingKey: key,
      });
      await channel.bindQueue(queue, this.exchange, key);
      await channel.assertQueue(`${queue}.retry`, {
        durable: true,
        messageTtl: 1000,
        deadLetterExchange: this.exchange,
        deadLetterRoutingKey: key,
      });
    }
    await channel.prefetch(1);
    this.channel = channel;
    for (const [queue, handler] of this.subscriptions) await this.consume(channel, queue, handler);
    return channel;
  }
  async ensure() {
    await this.open();
  }
  async subscribe(queue: string, handler: (event: unknown) => Promise<void>) {
    const full = this.prefix + queue;
    if (this.subscriptions.has(full)) {
      await this.open();
      return;
    }
    this.subscriptions.set(full, handler);
    if (this.channel) await this.consume(this.channel, full, handler);
    else await this.open();
  }
  private async consume(
    channel: ConfirmChannel,
    queue: string,
    handler: (event: unknown) => Promise<void>,
  ) {
    await channel.consume(
      queue,
      (message) => {
        if (message) void this.deliver(channel, queue, message, handler);
      },
      { noAck: false },
    );
  }
  private async deliver(
    channel: ConfirmChannel,
    queue: string,
    message: ConsumeMessage,
    handler: (event: unknown) => Promise<void>,
  ) {
    try {
      await handler(JSON.parse(message.content.toString()) as unknown);
      channel.ack(message);
    } catch {
      const attempts = Number(message.properties.headers?.['x-checkout-attempt'] ?? 0);
      if (attempts >= 5) {
        channel.nack(message, false, false);
        return;
      }
      try {
        await new Promise<void>((resolve, reject) =>
          channel.sendToQueue(
            `${queue}.retry`,
            message.content,
            {
              ...message.properties,
              persistent: true,
              headers: { ...message.properties.headers, 'x-checkout-attempt': attempts + 1 },
            },
            (error) => (error ? reject(error) : resolve()),
          ),
        );
        channel.ack(message);
      } catch {
        if (!this.stopping)
          try {
            channel.nack(message, false, true);
          } catch {
            /* broker will redeliver unacked messages */
          }
      }
    }
  }
  async publish(event: CheckoutEvent) {
    const channel = await this.open();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Broker confirmation timed out')), 3000);
      channel.publish(
        this.exchange,
        checkoutRoutingKey(event),
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: event.eventId,
          correlationId: event.correlationId,
        },
        (error) => {
          clearTimeout(timer);
          if (error) reject(error);
          else resolve();
        },
      );
    });
  }
  async onModuleDestroy() {
    this.stopping = true;
    await this.channel?.close().catch(() => {});
    await this.connection?.close().catch(() => {});
  }
}
