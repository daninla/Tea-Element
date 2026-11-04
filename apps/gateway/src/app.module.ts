import { PaymentsModule } from './modules/payments/payments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { readEnvironment } from './config/environment';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HealthModule } from './modules/health/health.module';
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: readEnvironment().LOG_LEVEL,
        redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
        serializers: { req: (request: { method: string }) => ({ method: request.method }) },
        genReqId: (request, response) => {
          const supplied = request.headers['x-correlation-id'];
          const id =
            typeof supplied === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(supplied)
              ? supplied
              : randomUUID();
          response.setHeader('x-correlation-id', id);
          return id;
        },
        customProps: (request) => ({ correlationId: request.id }),
      },
    }),
    HealthModule,
    CatalogModule,
    OrdersModule,
    PaymentsModule,
    AuthModule,
  ],
})
export class AppModule {}
