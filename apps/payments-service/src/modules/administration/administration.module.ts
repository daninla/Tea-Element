import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { AdminPaymentsStore } from './domain/admin-payments-store';
import { PrismaAdminPaymentsStore } from './infrastructure/prisma-admin-payments-store';
import { ReadAdminPayments } from './application/read-admin-payments';
import { RequestPaymentReconciliation } from './application/request-payment-reconciliation';
import { AdminPaymentsRpcController } from './presentation/admin-payments-rpc.controller';
@Module({
  imports: [PaymentsModule],
  controllers: [AdminPaymentsRpcController],
  providers: [
    ReadAdminPayments,
    RequestPaymentReconciliation,
    { provide: AdminPaymentsStore, useClass: PrismaAdminPaymentsStore },
  ],
})
export class AdministrationModule {}
