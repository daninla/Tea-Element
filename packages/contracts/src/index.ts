export const SERVICE_NAMES = [
  'gateway',
  'auth-service',
  'catalog-service',
  'orders-service',
  'payments-service',
  'marketing-service',
] as const;
export type ServiceName = (typeof SERVICE_NAMES)[number];
export interface HealthResponse {
  status: 'ok';
  service: ServiceName | 'web';
}
export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
  correlationId: string;
}

export * from './auth';
