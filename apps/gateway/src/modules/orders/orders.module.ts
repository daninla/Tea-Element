import { CatalogModule } from '../catalog/catalog.module';
import { AdminOrdersController } from './presentation/admin-orders.controller';
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { OrdersClient } from './domain/orders-client';
import { RmqOrdersClient } from './infrastructure/rmq-orders-client';
import { ForwardOrders } from './application/forward-orders';
import { OrdersController, CartController } from './presentation/orders.controller';
@Module({
  imports: [
    CatalogModule,
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
  controllers: [OrdersController, CartController, AdminOrdersController],
  providers: [ForwardOrders, { provide: OrdersClient, useClass: RmqOrdersClient }],
})
export class OrdersModule {}
