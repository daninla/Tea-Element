import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Headers,
  Param,
  Query,
  Req,
  Res,
  Inject,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  CATALOG_ADMIN_PATTERNS,
  Role,
  type AdminCategory,
  type AdminProduct,
  type AdminProductPage,
  type AdminCategoryPage,
  type CatalogAuditPage,
  type MediaAssetView,
} from '@tea/contracts';
import { ForwardCatalog } from '../application/forward-catalog';
import { Roles, Public, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
import {
  IsOptional,
  IsInt,
  IsString,
  IsIn,
  IsUUID,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
class ListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(['TEA', 'EQUIPMENT']) section?: 'TEA' | 'EQUIPMENT';
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  active?: boolean;
}
class IdDto {
  @IsUUID() id!: string;
}
class FileDto {
  @Matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/) file!: string;
}
function context(r: AuthenticatedRequest) {
  return { userId: r.user!.sub, role: r.user!.role, correlationId: String(r.id) };
}
// Catalog-service validates complete command schemas; the gateway accepts an opaque object only here.
@Controller('api/v1/admin')
@Roles(Role.ADMIN)
export class CatalogAdminController {
  constructor(@Inject(ForwardCatalog) private readonly catalog: ForwardCatalog) {}
  @Get('products') products(
    @Query() x: ListDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<AdminProductPage>(CATALOG_ADMIN_PATTERNS.read, {
      input: { kind: 'PRODUCTS', page: x.page ?? 1, q: x.q, section: x.section, active: x.active },
      context: context(r),
    });
  }
  @Get('products/:id') product(
    @Param() x: IdDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<AdminProduct>(CATALOG_ADMIN_PATTERNS.read, {
      input: { kind: 'PRODUCT', id: x.id },
      context: context(r),
    });
  }
  @Get('categories') categories(
    @Query() x: ListDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<AdminCategoryPage>(CATALOG_ADMIN_PATTERNS.read, {
      input: {
        kind: 'CATEGORIES',
        page: x.page ?? 1,
        pageSize: x.pageSize,
        q: x.q,
        section: x.section,
      },
      context: context(r),
    });
  }
  @Get('catalog/:id/audit') audit(
    @Param() x: IdDto,
    @Query() q: ListDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<CatalogAuditPage>(CATALOG_ADMIN_PATTERNS.read, {
      input: { kind: 'AUDIT', id: x.id, page: q.page ?? 1 },
      context: context(r),
    });
  }
  @Post('products') @HttpCode(200) createProduct(
    @Body() input: unknown,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<AdminProduct>(CATALOG_ADMIN_PATTERNS.write, {
      input: { kind: 'CREATE_PRODUCT', input, key },
      context: context(r),
    });
  }
  @Patch('products/:id') updateProduct(
    @Param() x: IdDto,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const { input, expectedRevision } = updateBody(body);
    return this.catalog.execute<AdminProduct>(CATALOG_ADMIN_PATTERNS.write, {
      input: { kind: 'UPDATE_PRODUCT', id: x.id, input, expectedRevision, key },
      context: context(r),
    });
  }
  @Post('categories') @HttpCode(200) createCategory(
    @Body() input: unknown,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<AdminCategory>(CATALOG_ADMIN_PATTERNS.write, {
      input: { kind: 'CREATE_CATEGORY', input, key },
      context: context(r),
    });
  }
  @Patch('categories/:id') updateCategory(
    @Param() x: IdDto,
    @Body() body: unknown,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const { input, expectedRevision } = updateBody(body);
    return this.catalog.execute<AdminCategory>(CATALOG_ADMIN_PATTERNS.write, {
      input: { kind: 'UPDATE_CATEGORY', id: x.id, input, expectedRevision, key },
      context: context(r),
    });
  }
  @Post('media')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5242880, files: 1, fields: 0 } }))
  upload(
    @UploadedFile() file: { buffer: Buffer } | undefined,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    if (!file) throw new BadRequestException('Image required');
    return this.catalog.execute<MediaAssetView>(CATALOG_ADMIN_PATTERNS.upload, {
      input: { base64: file.buffer.toString('base64') },
      context: context(r),
    });
  }
}
function updateBody(body: unknown) {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((k) => !['input', 'expectedRevision'].includes(k))
  )
    throw new BadRequestException('Invalid update');
  return body as { input: unknown; expectedRevision: unknown };
}
@Throttle({ default: { limit: 180, ttl: 60000 } })
@Controller('api/v1/media')
export class CatalogMediaController {
  constructor(@Inject(ForwardCatalog) private readonly catalog: ForwardCatalog) {}
  @Public() @Get(':file') async image(
    @Param() x: FileDto,
    @Req() r: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const data = await this.catalog.execute<{ base64: string; etag: string }>(
      CATALOG_ADMIN_PATTERNS.media,
      { input: { id: x.file.slice(0, -5) }, context: { correlationId: String(r.id) } },
    );
    const bytes = Buffer.from(data.base64, 'base64');
    res
      .set({
        'Content-Type': 'image/webp',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: '"' + data.etag + '"',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  }
}
