import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import {
  CATALOG_MARKETING_PROMOTIONS_PATTERN,
  type OrdersResult,
  type MarketingPromotionPage,
} from '@tea/contracts';
import { ReadMarketingPromotions } from '../application/read-marketing-promotions';
@Controller()
export class MarketingPromotionsController {
  constructor(@Inject(ReadMarketingPromotions) private readonly read: ReadMarketingPromotions) {}
  @MessagePattern(CATALOG_MARKETING_PROMOTIONS_PATTERN) async execute(
    @Payload() raw: unknown,
  ): Promise<OrdersResult<MarketingPromotionPage>> {
    const parsed = z
      .object({
        input: z.object({ after: z.string().uuid().optional() }).strict(),
        context: z.object({ correlationId: z.string().min(1).max(100) }).strict(),
      })
      .strict()
      .safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
      };
    try {
      return { ok: true, value: await this.read.execute(parsed.data.input.after) };
    } catch {
      return {
        ok: false,
        error: { code: 'CATALOG_UNAVAILABLE', message: 'Catalog unavailable', statusCode: 503 },
      };
    }
  }
}
