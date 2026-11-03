import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/presentation/auth-policy';
import { SkipThrottle } from '@nestjs/throttler';
import { CheckHealth } from '../application/check-health';
@ApiTags('Operations')
@Controller('health')
export class HealthController {
  constructor(@Inject(CheckHealth) private readonly checkHealth: CheckHealth) {}
  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Process liveness (does not check infrastructure readiness)' })
  check() {
    return this.checkHealth.execute();
  }
}
