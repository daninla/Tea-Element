import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CustomerAccountsStore } from './domain/customer-accounts-store';
import { ReadCustomerAccounts } from './application/read-customer-accounts';
import { PrismaCustomerAccountsStore } from './infrastructure/prisma-customer-accounts-store';
import { CustomerAccountsRpcController } from './presentation/customer-accounts-rpc.controller';
@Module({
  imports: [AuthModule],
  controllers: [CustomerAccountsRpcController],
  providers: [
    ReadCustomerAccounts,
    { provide: CustomerAccountsStore, useClass: PrismaCustomerAccountsStore },
  ],
})
export class CustomersModule {}
