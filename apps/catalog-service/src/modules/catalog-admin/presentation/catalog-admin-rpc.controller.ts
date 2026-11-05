import { Controller, Inject } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { z } from 'zod';
import { CATALOG_ADMIN_PATTERNS, type CatalogResult } from '@tea/contracts';
import { inventoryContext } from '../../inventory/presentation/inventory-schema';
import { CatalogAdminError } from '../domain/catalog-admin-store';
import { ReadCatalogAdmin } from '../application/read-catalog-admin';
import { WriteCatalogAdmin } from '../application/write-catalog-admin';
import { UploadCatalogImage } from '../application/upload-catalog-image';
import { ReadCatalogImage } from '../application/read-catalog-image';
import { adminRead, adminWrite } from './catalog-admin-schema';
async function run<T>(
  input: T,
  action: (input: T) => Promise<unknown>,
): Promise<CatalogResult<unknown>> {
  try {
    return { ok: true, value: await action(input) };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof CatalogAdminError
          ? { code: e.code, message: e.message, statusCode: e.statusCode }
          : { code: 'CATALOG_UNAVAILABLE', message: 'Catalog unavailable', statusCode: 503 },
    };
  }
}
async function admin<T>(
  raw: unknown,
  schema: z.ZodType<T>,
  action: (input: T, actor: string) => Promise<unknown>,
) {
  const envelope = z
    .object({ input: z.unknown(), context: inventoryContext })
    .strict()
    .safeParse(raw);
  if (!envelope.success)
    return {
      ok: false,
      error: { code: 'FORBIDDEN', message: 'Administrator required', statusCode: 403 },
    };
  const parsed = schema.safeParse(envelope.data.input);
  if (!parsed.success)
    return {
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
    };
  return run(parsed.data, (x) => action(x, envelope.data.context.userId));
}
@Controller()
export class CatalogAdminRpcController {
  constructor(
    @Inject(ReadCatalogAdmin) private readonly read: ReadCatalogAdmin,
    @Inject(WriteCatalogAdmin) private readonly write: WriteCatalogAdmin,
    @Inject(UploadCatalogImage) private readonly upload: UploadCatalogImage,
    @Inject(ReadCatalogImage) private readonly media: ReadCatalogImage,
  ) {}
  @MessagePattern(CATALOG_ADMIN_PATTERNS.read) query(@Payload() raw: unknown) {
    return admin(raw, adminRead, (x) => this.read.execute(x));
  }
  @MessagePattern(CATALOG_ADMIN_PATTERNS.write) save(@Payload() raw: unknown) {
    return admin(raw, adminWrite, (x, a) => this.write.execute(x, a));
  }
  @MessagePattern(CATALOG_ADMIN_PATTERNS.upload) photo(@Payload() raw: unknown) {
    return admin(raw, z.object({ base64: z.string().min(16).max(6990508) }).strict(), (x, a) =>
      this.upload.execute(x.base64, a),
    );
  }
  @MessagePattern(CATALOG_ADMIN_PATTERNS.media) image(@Payload() raw: unknown) {
    const parsed = z
      .object({
        input: z.object({ id: z.string().uuid() }).strict(),
        context: z.object({ correlationId: z.string().min(1).max(100) }).strict(),
      })
      .strict()
      .safeParse(raw);
    if (!parsed.success)
      return {
        ok: false,
        error: { code: 'INVALID_INPUT', message: 'Invalid input', statusCode: 400 },
      };
    return run(parsed.data.input, (x) => this.media.execute(x.id));
  }
}
