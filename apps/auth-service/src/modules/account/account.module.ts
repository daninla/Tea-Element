import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { AuthModule } from '../auth/auth.module';
import { AccountStore, RegistrationOrderAccess } from './domain/account-store';
import { PrismaAccountStore } from './infrastructure/prisma-account-store';
import { RmqRegistrationOrderAccess } from './infrastructure/rmq-registration-order-access';
import { ChallengeMailWorker } from './infrastructure/challenge-mail-worker';
import { RequestEmail } from './application/request-email';
import { ConfirmEmail } from './application/confirm-email';
import { ResetPassword } from './application/reset-password';
import { UpdateProfile } from './application/update-profile';
import { RegisterFromOrder } from './application/register-from-order';
import { AccountRpcController } from './presentation/account-rpc.controller';
@Module({
  imports: [
    AuthModule,
    ClientsModule.registerAsync([
      {
        name: 'ACCOUNT_ORDERS_TRANSPORT',
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
  controllers: [AccountRpcController],
  providers: [
    RequestEmail,
    ConfirmEmail,
    ResetPassword,
    UpdateProfile,
    RegisterFromOrder,
    ChallengeMailWorker,
    { provide: AccountStore, useClass: PrismaAccountStore },
    { provide: RegistrationOrderAccess, useClass: RmqRegistrationOrderAccess },
  ],
})
export class AccountModule {}
