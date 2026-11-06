import { CustomerOrdersStore } from './domain/customer-orders-store';
import { ReadCustomerOrders } from './application/read-customer-orders';
import { PrismaCustomerOrdersStore } from './infrastructure/prisma-customer-orders-store';
import { CustomerOrdersRpcController } from './presentation/customer-orders-rpc.controller';
import { AdminDashboardStore } from './domain/admin-dashboard-store';
import { ReadAdminDashboard } from './application/read-admin-dashboard';
import { PrismaAdminDashboardStore } from './infrastructure/prisma-admin-dashboard-store';
import { AdminDashboardRpcController } from './presentation/admin-dashboard-rpc.controller';
import { TransitionAdminOrder } from './application/transition-admin-order';
import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { AdminOrdersStore } from './domain/admin-orders-store';
import { ReadAdminOrders } from './application/read-admin-orders';
import { ReadAdminOrder } from './application/read-admin-order';
import { PrismaAdminOrdersStore } from './infrastructure/prisma-admin-orders-store';
import { AdminOrdersRpcController } from './presentation/admin-orders-rpc.controller';
@Module({
  imports: [OrdersModule],
  controllers: [AdminOrdersRpcController, AdminDashboardRpcController, CustomerOrdersRpcController],
  providers: [
    ReadAdminOrders,
    ReadCustomerOrders,
    { provide: CustomerOrdersStore, useClass: PrismaCustomerOrdersStore },
    ReadAdminDashboard,
    { provide: AdminDashboardStore, useClass: PrismaAdminDashboardStore },
    TransitionAdminOrder,
    ReadAdminOrder,
    { provide: AdminOrdersStore, useClass: PrismaAdminOrdersStore },
  ],
})
export class AdministrationModule {}
