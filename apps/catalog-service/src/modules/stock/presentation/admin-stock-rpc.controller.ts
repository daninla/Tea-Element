import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { ADMIN_STOCK_PATTERN, type CatalogResult, type StockMovementPage } from '@tea/contracts';
import { ReadStockMovements } from '../application/read-stock-movements';
@Controller()
export class AdminStockRpcController {
  constructor(@Inject(ReadStockMovements) private readonly read: ReadStockMovements) {}
  @MessagePattern(ADMIN_STOCK_PATTERN) async movements(
    @Payload() raw: unknown,
  ): Promise<CatalogResult<StockMovementPage>> {
    const envelope = z
      .object({
        input: z.unknown(),
        context: z
          .object({
            userId: z.string().uuid(),
            role: z.literal('ADMIN'),
            correlationId: z.string().min(1).max(100),
          })
          .strict(),
      })
      .strict()
      .safeParse(raw);
    if (!envelope.success)
      return {
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
      };
    const input = z
      .object({ orderId: z.string().uuid(), page: z.number().int().min(1).max(10000) })
      .strict()
      .safeParse(envelope.data.input);
    if (!input.success)
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
      };
    try {
      return { ok: true, value: await this.read.execute(input.data.orderId, input.data.page) };
    } catch {
      return {
        ok: false,
        error: { code: 'CATALOG_UNAVAILABLE', message: 'Inventory unavailable', statusCode: 503 },
      };
    }
  }
}
