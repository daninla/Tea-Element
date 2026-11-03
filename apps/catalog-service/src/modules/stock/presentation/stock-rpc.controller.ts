import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CATALOG_PATTERNS } from '@tea/contracts';
import { z } from 'zod';
import { QuoteCart } from '../application/quote-cart';
const schema = z
  .object({
    input: z
      .object({
        items: z
          .array(
            z
              .object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) })
              .strict(),
          )
          .max(50)
          .refine((items) => new Set(items.map((x) => x.variantId)).size === items.length),
      })
      .strict(),
    context: z.object({ correlationId: z.string().min(1).max(100) }).strict(),
  })
  .strict();
@Controller()
export class StockRpcController {
  constructor(@Inject(QuoteCart) private readonly quote: QuoteCart) {}
  @MessagePattern(CATALOG_PATTERNS.quote)
  async execute(@Payload() raw: unknown) {
    const data = schema.safeParse(raw);
    if (!data.success)
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid cart', statusCode: 400 },
      };
    try {
      return { ok: true, value: await this.quote.execute(data.data.input.items) };
    } catch {
      return {
        ok: false,
        error: {
          code: 'CATALOG_UNAVAILABLE',
          message: 'Catalog temporarily unavailable',
          statusCode: 503,
        },
      };
    }
  }
}
