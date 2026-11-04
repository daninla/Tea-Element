import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { PaymentsClient } from './domain/payments-client';
import { RmqPaymentsClient } from './infrastructure/rmq-payments-client';
import { ForwardPayments } from './application/forward-payments';
import { PaymentsController } from './presentation/payments.controller';
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'PAYMENTS_TRANSPORT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [readEnvironment().RABBITMQ_URL],
            queue: readEnvironment().PAYMENTS_RPC_QUEUE,
            queueOptions: { durable: true, messageTtl: 6000 },
            persistent: false,
          },
        }),
      },
    ]),
  ],
  controllers: [PaymentsController],
  providers: [ForwardPayments, { provide: PaymentsClient, useClass: RmqPaymentsClient }],
})
export class PaymentsModule {}
