import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { readEnvironment } from './config/environment';
async function bootstrap() {
  const env = readEnvironment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle('Tea Element — catalog-service')
    .setVersion('0.0.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [env.RABBITMQ_URL],
      queue: env.CATALOG_RPC_QUEUE,
      queueOptions: { durable: true, messageTtl: 6000 },
      noAck: true,
      prefetchCount: 10,
    },
  });
  await app.startAllMicroservices();
  await app.listen(env.PORT, '0.0.0.0');
}
void bootstrap().catch(() => {
  process.stderr.write(
    'Service startup failed. Check environment and infrastructure configuration.\n',
  );
  process.exitCode = 1;
});
