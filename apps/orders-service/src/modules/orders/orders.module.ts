import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { PrismaService } from '../../shared/prisma.service';
import { RabbitEventBus } from '../../shared/outbox/rabbit-event-bus';
import { OutboxPublisher } from '../../shared/outbox/outbox-publisher';
import { OrderStore, QuoteProvider } from './domain/order-store';
import { PrismaOrderStore } from './infrastructure/prisma-order-store';
import { RmqQuoteProvider } from './infrastructure/rmq-quote-provider';
import { ReceiptWorker } from './infrastructure/receipt-worker';
import { AccountOrders } from './application/account-orders';
import { ChangePayment } from './application/change-payment';
import { CreateOrder } from './application/create-order';
import { GetOrder } from './application/get-order';
import { CancelOrder } from './application/cancel-order';
import { ReadCart } from './application/read-cart';
import { SaveCart } from './application/save-cart';
import { MergeCart } from './application/merge-cart';
import { QuoteCart } from './application/quote-cart';
import { HandleOrderEvent } from './application/handle-order-event';
import { ExpireReservations } from './application/expire-reservations';
import { OrdersRpcController } from './presentation/orders-rpc.controller';
import { CheckoutDelivery } from './application/checkout-delivery';
import { DeliveryProvider } from './domain/delivery-provider';
import { PostalDeliveryProvider } from './infrastructure/postal-delivery-provider';
import { OrderWorker } from './presentation/order-worker';
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'CATALOG_TRANSPORT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [readEnvironment().RABBITMQ_URL],
            queue: readEnvironment().CATALOG_RPC_QUEUE,
            queueOptions: { durable: true, messageTtl: 6000 },
            persistent: false,
          },
        }),
      },
    ]),
  ],
  controllers: [OrdersRpcController],
  exports: [PrismaService],
  providers: [
    PrismaService,
    RabbitEventBus,
    OutboxPublisher,
    ReceiptWorker,
    OrderWorker,
    { provide: OrderStore, useClass: PrismaOrderStore },
    { provide: QuoteProvider, useClass: RmqQuoteProvider },
    CreateOrder,
    CheckoutDelivery,
    { provide: DeliveryProvider, useClass: PostalDeliveryProvider },
    ChangePayment,
    AccountOrders,
    GetOrder,
    CancelOrder,
    ReadCart,
    SaveCart,
    MergeCart,
    QuoteCart,
    HandleOrderEvent,
    ExpireReservations,
  ],
})
export class OrdersModule {}
