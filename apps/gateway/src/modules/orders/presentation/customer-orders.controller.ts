import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import {
  IsOptional,
  IsInt,
  IsString,
  IsUUID,
  IsEmail,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { Response } from 'express';
import {
  ADMIN_CUSTOMERS_PATTERNS,
  Role,
  type CustomerHistory,
  type GuestCustomerPage,
} from '@tea/contracts';
import { ForwardOrders } from '../application/forward-orders';
import { Roles, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
class Filters {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
class History {
  @IsIn(['ACCOUNT', 'GUEST']) kind!: 'ACCOUNT' | 'GUEST';
  @IsOptional() @IsUUID() id?: string;
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
}
function context(r: AuthenticatedRequest) {
  return { userId: r.user!.sub, role: r.user!.role, correlationId: String(r.id) };
}
@Controller('api/v1/admin/customers')
@Roles(Role.ADMIN)
export class CustomerOrdersController {
  constructor(@Inject(ForwardOrders) private readonly orders: ForwardOrders) {}
  @Get('guests') list(
    @Query() x: Filters,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.orders.execute<GuestCustomerPage>(ADMIN_CUSTOMERS_PATTERNS.orders, {
      input: { kind: 'GUESTS', page: x.page ?? 1, q: x.q },
      context: context(r),
    });
  }
  @Get('history') history(
    @Query() x: History,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.orders.execute<CustomerHistory>(ADMIN_CUSTOMERS_PATTERNS.orders, {
      input: {
        kind: 'HISTORY',
        page: x.page ?? 1,
        customer: {
          kind: x.kind,
          ...(x.id !== undefined ? { id: x.id } : {}),
          ...(x.email !== undefined ? { email: x.email } : {}),
        },
      },
      context: context(r),
    });
  }
}
