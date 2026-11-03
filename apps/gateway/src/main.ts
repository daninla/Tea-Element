import type { Request, Response, NextFunction } from 'express';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { HttpErrorFilter } from './shared/http-error.filter';
import { AppModule } from './app.module';
import { readEnvironment } from './config/environment';
async function bootstrap() {
  const env = readEnvironment();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use('/api/v1/orders', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  app.use('/api/v1/cart', (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cookieParser());
  app.useGlobalFilters(new HttpErrorFilter());
  app.enableCors({ origin: env.CORS_ORIGIN, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.enableShutdownHooks();
  const config = new DocumentBuilder()
    .setTitle('Tea Element — gateway')
    .setVersion('0.1.0')
    .addCookieAuth('tea_access')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  await app.listen(env.PORT, '0.0.0.0');
}
void bootstrap().catch(() => {
  process.stderr.write(
    'Service startup failed. Check environment and infrastructure configuration.\n',
  );
  process.exitCode = 1;
});
