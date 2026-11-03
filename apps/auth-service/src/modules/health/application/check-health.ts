import type { HealthResponse } from '@tea/contracts';
export class CheckHealth {
  execute(): HealthResponse {
    return { status: 'ok', service: 'auth-service' };
  }
}
