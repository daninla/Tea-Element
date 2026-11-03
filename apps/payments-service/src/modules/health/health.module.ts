import { Module } from '@nestjs/common';
import { CheckHealth } from './application/check-health';
import { HealthController } from './presentation/health.controller';
@Module({ controllers: [HealthController], providers: [CheckHealth] })
export class HealthModule {}
