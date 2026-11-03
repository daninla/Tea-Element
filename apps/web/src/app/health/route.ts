import type { HealthResponse } from '@tea/contracts';
export function GET() {
  return Response.json({ status: 'ok', service: 'web' } satisfies HealthResponse);
}
