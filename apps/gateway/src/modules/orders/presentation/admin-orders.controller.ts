import { Controller, Get, Inject, Param, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  ADMIN_ORDERS_PATTERNS,
  ORDER_STATUSES,
  Role,
  type OrderStatus,
  type AdminOrderPage,
  type AdminOrderDetail,
} from '@tea/contracts';
import { Roles, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
import { ForwardOrders } from '../application/forward-orders';
class AdminOrderFiltersDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(ORDER_STATUSES) status?: OrderStatus;
  @IsOptional() @IsIn(['CASH_ON_DELIVERY', 'ONLINE_CARD']) paymentMethod?:
    'CASH_ON_DELIVERY' | 'ONLINE_CARD';
  @IsOptional() @IsIn(['GUEST', 'ACCOUNT']) customerType?: 'GUEST' | 'ACCOUNT';
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
class AdminOrderIdDto {
  @IsUUID() id!: string;
}
@Controller('api/v1/admin/orders')
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(@Inject(ForwardOrders) private readonly orders: ForwardOrders) {}
  @Get() list(
    @Query() filters: AdminOrderFiltersDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.orders.execute<AdminOrderPage>(ADMIN_ORDERS_PATTERNS.list, {
      input: { ...filters, page: filters.page ?? 1 },
      context: {
        userId: request.user!.sub,
        role: request.user!.role,
        correlationId: String(request.id),
      },
    });
  }
  @Get(':id') detail(
    @Param() params: AdminOrderIdDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.orders.execute<AdminOrderDetail>(ADMIN_ORDERS_PATTERNS.detail, {
      input: params,
      context: {
        userId: request.user!.sub,
        role: request.user!.role,
        correlationId: String(request.id),
      },
    });
  }
}
