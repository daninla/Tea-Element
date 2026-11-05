import {
  Body,
  Controller,
  Get,
  Post,
  Headers,
  Param,
  Query,
  Req,
  Res,
  Inject,
  HttpCode,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  IsOptional,
  IsInt,
  IsString,
  IsIn,
  IsUUID,
  IsBoolean,
  IsISO8601,
  Min,
  Max,
  Length,
  MaxLength,
  NotEquals,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  INVENTORY_PATTERNS,
  Role,
  type InventoryPage,
  type InventoryItem,
  type InventoryHistory,
  type InventoryCommandResult,
} from '@tea/contracts';
import { ForwardCatalog } from '../application/forward-catalog';
import { Roles, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
class ListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(['ALL', 'TEA', 'EQUIPMENT']) section?: 'ALL' | 'TEA' | 'EQUIPMENT';
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  lowStock?: boolean;
}
class IdDto {
  @IsUUID() id!: string;
}
class HistoryDto {
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
}
class PurchaseDto {
  @IsUUID() productId!: string;
  @IsInt() @Min(1) @Max(100000000) quantity!: number;
  @IsInt() @Min(0) @Max(2147483647) purchasePriceTotal!: number;
  @IsString() @Length(1, 200) supplier!: string;
  @IsISO8601({ strict: true }) purchasedAt!: string;
  @IsString() @Length(3, 500) note!: string;
}
class AdjustDto {
  @IsInt() @Min(-100000000) @Max(100000000) @NotEquals(0) delta!: number;
  @IsInt() @Min(0) @Max(2147483647) expectedStock!: number;
  @IsIn(['ADJUSTMENT', 'WRITE_OFF']) kind!: 'ADJUSTMENT' | 'WRITE_OFF';
  @IsString() @Length(3, 500) reason!: string;
}
function context(r: AuthenticatedRequest) {
  return { userId: r.user!.sub, role: r.user!.role, correlationId: String(r.id) };
}
@Controller('api/v1/admin/inventory')
@Roles(Role.ADMIN)
export class InventoryController {
  constructor(@Inject(ForwardCatalog) private readonly catalog: ForwardCatalog) {}
  @Get() list(
    @Query() input: ListDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<InventoryPage>(INVENTORY_PATTERNS.list, {
      input: { ...input, page: input.page ?? 1 },
      context: context(r),
    });
  }
  @Get('purchases') purchases(
    @Query() input: HistoryDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<InventoryHistory>(INVENTORY_PATTERNS.history, {
      input: { ...input, page: input.page ?? 1, kind: 'PURCHASES' },
      context: context(r),
    });
  }
  @Get('movements') movements(
    @Query() input: HistoryDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<InventoryHistory>(INVENTORY_PATTERNS.history, {
      input: { ...input, page: input.page ?? 1, kind: 'MOVEMENTS' },
      context: context(r),
    });
  }
  @Get(':id') get(
    @Param() input: IdDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<InventoryItem>(INVENTORY_PATTERNS.get, {
      input: { productId: input.id },
      context: context(r),
    });
  }
  @Post('purchases') @HttpCode(200) purchase(
    @Body() input: PurchaseDto,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<InventoryCommandResult>(INVENTORY_PATTERNS.purchase, {
      input: { ...input, key },
      context: context(r),
    });
  }
  @Post(':id/adjust') @HttpCode(200) adjust(
    @Param() params: IdDto,
    @Body() input: AdjustDto,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<InventoryCommandResult>(INVENTORY_PATTERNS.adjust, {
      input: { ...input, productId: params.id, key },
      context: context(r),
    });
  }
}
