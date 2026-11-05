import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminOrdersStore } from './domain/admin-orders-store';
import { ReadAdminOrders } from './application/read-admin-orders';
import { ReadAdminOrder } from './application/read-admin-order';
import { PrismaAdminOrdersStore } from './infrastructure/prisma-admin-orders-store';
import { AdminOrdersRpcController } from './presentation/admin-orders-rpc.controller';
@Module({
  imports: [OrdersModule],
  controllers: [AdminOrdersRpcController],
  providers: [
    ReadAdminOrders,
    ReadAdminOrder,
    { provide: AdminOrdersStore, useClass: PrismaAdminOrdersStore },
  ],
})
export class AdministrationModule {}
