import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { readEnvironment } from '../../config/environment';
import { AuthClient } from './domain/auth-client';
import { RmqAuthClient } from './infrastructure/rmq-auth-client';
import { ForwardAuth } from './application/forward-auth';
import { AccountController } from './presentation/account.controller';
import { AuthController, AdminAuthController } from './presentation/auth.controller';
import { OriginGuard } from './presentation/origin.guard';
import { JwtAuthGuard } from './presentation/jwt-auth.guard';
import { RolesGuard } from './presentation/roles.guard';
@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    ClientsModule.registerAsync([
      {
        name: 'AUTH_TRANSPORT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [readEnvironment().RABBITMQ_URL],
            queue: readEnvironment().AUTH_RPC_QUEUE,
            queueOptions: { durable: true, messageTtl: 6000 },
            persistent: false,
          },
        }),
      },
    ]),
  ],
  controllers: [AuthController, AdminAuthController, AccountController],
  providers: [
    ForwardAuth,
    { provide: AuthClient, useClass: RmqAuthClient },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
