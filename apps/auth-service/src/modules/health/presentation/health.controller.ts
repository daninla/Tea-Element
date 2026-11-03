import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CheckHealth } from '../application/check-health';
@ApiTags('Operations')
@Controller('health')
export class HealthController {
  constructor(@Inject(CheckHealth) private readonly checkHealth: CheckHealth) {}
  @Get()
  @ApiOperation({ summary: 'Process liveness (does not check infrastructure readiness)' })
  check() {
    return this.checkHealth.execute();
  }
}
