import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import {
  CATALOG_PATTERNS,
  CATALOG_SORTS,
  CATALOG_SECTIONS,
  type CatalogResult,
} from '@tea/contracts';
import { ListCategories } from '../application/list-categories';
import { ListProducts } from '../application/list-products';
import { GetProduct } from '../application/get-product';
import { CatalogError } from '../domain/catalog-repository';
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(160);
const query = z
  .object({
    section: z.enum(CATALOG_SECTIONS).optional(),
    category: slug.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    origin: z.string().trim().min(1).max(150).optional(),
    minPrice: z.number().int().min(0).max(2147483647).optional(),
    maxPrice: z.number().int().min(0).max(2147483647).optional(),
    onSale: z.boolean().optional(),
    inStock: z.boolean().optional(),
    sort: z.enum(CATALOG_SORTS).optional(),
    page: z.number().int().min(1).max(10000).optional(),
    pageSize: z.number().int().min(1).max(48).optional(),
  })
  .strict();
async function handle<T, R>(
  raw: unknown,
  input: z.ZodType<T>,
  execute: (input: T) => Promise<R>,
): Promise<CatalogResult<R>> {
  const result = z
    .object({ input, context: z.object({ correlationId: z.string().min(1).max(100) }).strict() })
    .strict()
    .safeParse(raw);
  if (!result.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid catalog query', statusCode: 400 },
    };
  try {
    return { ok: true, value: await execute(result.data.input as T) };
  } catch (error) {
    if (error instanceof CatalogError)
      return {
        ok: false,
        error: { code: error.code, message: error.message, statusCode: error.statusCode },
      };
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
@Controller()
export class CatalogRpcController {
  constructor(
    @Inject(ListCategories) private readonly categories: ListCategories,
    @Inject(ListProducts) private readonly products: ListProducts,
    @Inject(GetProduct) private readonly product: GetProduct,
  ) {}
  @MessagePattern(CATALOG_PATTERNS.categories)
  listCategories(@Payload() raw: unknown) {
    return handle(raw, z.object({}).strict(), () => this.categories.execute());
  }
  @MessagePattern(CATALOG_PATTERNS.products)
  listProducts(@Payload() raw: unknown) {
    return handle(raw, query, (input) => this.products.execute(input));
  }
  @MessagePattern(CATALOG_PATTERNS.product)
  getProduct(@Payload() raw: unknown) {
    return handle(raw, z.object({ slug }).strict(), (input) => this.product.execute(input.slug));
  }
}
