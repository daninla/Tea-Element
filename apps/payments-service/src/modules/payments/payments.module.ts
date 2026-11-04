import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { PrismaService } from '../../shared/prisma.service';
import { RabbitEventBus } from '../../shared/outbox/rabbit-event-bus';
import { OutboxPublisher } from '../../shared/outbox/outbox-publisher';
import { PaymentProvidersModule } from './payment-providers.module';
import { PaymentStore, PaymentOrderAccess } from './domain/payment-store';
import { PrismaPaymentStore } from './infrastructure/prisma-payment-store';
import { RmqOrderAccess } from './infrastructure/rmq-order-access';
import { HandlePaymentEvent } from './application/handle-payment-event';
import { MaintainPayments } from './application/maintain-payments';
import { GetPayment } from './application/get-payment';
import { SimulatePayment } from './application/simulate-payment';
import { RecordWebhook } from './application/record-webhook';
import { PaymentsRpcController } from './presentation/payments-rpc.controller';
import { PaymentWorker } from './presentation/payment-worker';
@Module({
  imports: [
    PaymentProvidersModule,
    ClientsModule.registerAsync([
      {
        name: 'ORDERS_TRANSPORT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [readEnvironment().RABBITMQ_URL],
            queue: readEnvironment().ORDERS_RPC_QUEUE,
            queueOptions: { durable: true, messageTtl: 6000 },
            persistent: false,
          },
        }),
      },
    ]),
  ],
  controllers: [PaymentsRpcController],
  providers: [
    PrismaService,
    RabbitEventBus,
    OutboxPublisher,
    HandlePaymentEvent,
    MaintainPayments,
    GetPayment,
    RecordWebhook,
    SimulatePayment,
    PaymentWorker,
    { provide: PaymentStore, useClass: PrismaPaymentStore },
    { provide: PaymentOrderAccess, useClass: RmqOrderAccess },
  ],
})
export class PaymentsModule {}
