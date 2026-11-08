import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { MarketingClient } from './domain/marketing-client';
import { RmqMarketingClient } from './infrastructure/rmq-marketing-client';
import { ForwardMarketing } from './application/forward-marketing';
import { MarketingController } from './presentation/marketing.controller';
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'MARKETING_TRANSPORT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [readEnvironment().RABBITMQ_URL],
            queue: readEnvironment().MARKETING_RPC_QUEUE,
            queueOptions: { durable: true, messageTtl: 6000 },
            persistent: false,
          },
        }),
      },
    ]),
  ],
  controllers: [MarketingController],
  providers: [ForwardMarketing, { provide: MarketingClient, useClass: RmqMarketingClient }],
})
export class MarketingModule {}
