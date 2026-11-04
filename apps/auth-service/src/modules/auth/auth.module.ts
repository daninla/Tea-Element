import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../../shared/prisma.service';
import { AuthStore, PasswordHasher, AccessTokenSigner } from './domain/auth-store';
import { PrismaAuthStore } from './infrastructure/prisma-auth-store';
import { ArgonPasswordHasher } from './infrastructure/argon-password-hasher';
import { JwtAccessTokenSigner } from './infrastructure/jwt-access-token-signer';
import { AuthRpcController } from './presentation/auth-rpc.controller';
import { Register } from './application/register';
import { Login } from './application/login';
import { Refresh } from './application/refresh';
import { Logout } from './application/logout';
import { GetCurrentUser } from './application/get-current-user';
import { OutboxPublisher } from '../../shared/outbox/outbox-publisher';
import { RabbitEventBus } from '../../shared/outbox/rabbit-event-bus';
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthRpcController],
  exports: [Register, PasswordHasher, PrismaService],
  providers: [
    PrismaService,
    Register,
    Login,
    Refresh,
    Logout,
    GetCurrentUser,
    { provide: AuthStore, useClass: PrismaAuthStore },
    { provide: PasswordHasher, useClass: ArgonPasswordHasher },
    { provide: AccessTokenSigner, useClass: JwtAccessTokenSigner },
    OutboxPublisher,
    RabbitEventBus,
  ],
})
export class AuthModule {}
