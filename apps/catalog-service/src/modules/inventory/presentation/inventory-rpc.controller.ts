import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { INVENTORY_PATTERNS, type CatalogResult } from '@tea/contracts';
import { InventoryError } from '../domain/inventory-policy';
import { ListInventory } from '../application/list-inventory';
import { GetInventory } from '../application/get-inventory';
import { ReadInventoryHistory } from '../application/read-inventory-history';
import { RecordPurchase } from '../application/record-purchase';
import { AdjustInventory } from '../application/adjust-inventory';
import {
  inventoryContext,
  inventoryFilters,
  purchaseInput,
  adjustmentInput,
} from './inventory-schema';
async function handle<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  run: (input: T, actor: string) => Promise<unknown>,
): Promise<CatalogResult<unknown>> {
  const envelope = z
    .object({ input: z.unknown(), context: inventoryContext })
    .strict()
    .safeParse(raw);
  if (!envelope.success)
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
    };
  const input = schema.safeParse(envelope.data.input);
  if (!input.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
    };
  try {
    return { ok: true, value: await run(input.data, envelope.data.context.userId) };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof InventoryError
          ? { code: e.code, message: e.message, statusCode: e.statusCode }
          : { code: 'CATALOG_UNAVAILABLE', message: 'Inventory unavailable', statusCode: 503 },
    };
  }
}
@Controller()
export class InventoryRpcController {
  constructor(
    @Inject(ListInventory) private readonly list: ListInventory,
    @Inject(GetInventory) private readonly get: GetInventory,
    @Inject(ReadInventoryHistory) private readonly history: ReadInventoryHistory,
    @Inject(RecordPurchase) private readonly purchase: RecordPurchase,
    @Inject(AdjustInventory) private readonly adjust: AdjustInventory,
  ) {}
  @MessagePattern(INVENTORY_PATTERNS.list) read(@Payload() raw: unknown) {
    return handle(raw, inventoryFilters, (x) => this.list.execute(x));
  }
  @MessagePattern(INVENTORY_PATTERNS.get) detail(@Payload() raw: unknown) {
    return handle(raw, z.object({ productId: z.string().uuid() }).strict(), (x) =>
      this.get.execute(x.productId),
    );
  }
  @MessagePattern(INVENTORY_PATTERNS.history) journal(@Payload() raw: unknown) {
    return handle(
      raw,
      z
        .object({
          productId: z.string().uuid().optional(),
          kind: z.enum(['MOVEMENTS', 'PURCHASES']),
          page: z.number().int().min(1).max(10000),
        })
        .strict(),
      (x) => this.history.execute(x.productId, x.kind, x.page),
    );
  }
  @MessagePattern(INVENTORY_PATTERNS.purchase) receive(@Payload() raw: unknown) {
    return handle(raw, purchaseInput, (x, a) => this.purchase.execute(x, a));
  }
  @MessagePattern(INVENTORY_PATTERNS.adjust) change(@Payload() raw: unknown) {
    return handle(raw, adjustmentInput, (x, a) => this.adjust.execute(x, a));
  }
}
