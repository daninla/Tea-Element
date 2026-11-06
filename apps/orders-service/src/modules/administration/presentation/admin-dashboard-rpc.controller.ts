import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { ADMIN_DASHBOARD_PATTERN, type OrdersResult } from '@tea/contracts';
import { adminContext } from './admin-orders-schema';
import { ReadAdminDashboard } from '../application/read-admin-dashboard';
@Controller()
export class AdminDashboardRpcController {
  constructor(@Inject(ReadAdminDashboard) private readonly read: ReadAdminDashboard) {}
  @MessagePattern(ADMIN_DASHBOARD_PATTERN) async execute(
    @Payload() raw: unknown,
  ): Promise<OrdersResult<unknown>> {
    const envelope = z
      .object({ input: z.unknown(), context: adminContext })
      .strict()
      .safeParse(raw);
    if (!envelope.success)
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
      };
    const input = z
      .object({ days: z.union([z.literal(1), z.literal(7), z.literal(30)]) })
      .strict()
      .safeParse(envelope.data.input);
    if (!input.success)
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid period', statusCode: 400 },
      };
    try {
      return { ok: true, value: await this.read.execute(input.data.days) };
    } catch {
      return {
        ok: false,
        error: { code: 'ORDERS_UNAVAILABLE', message: 'Report unavailable', statusCode: 503 },
      };
    }
  }
}
