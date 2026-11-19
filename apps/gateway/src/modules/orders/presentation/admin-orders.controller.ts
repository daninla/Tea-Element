import { ForwardCatalog } from '../../catalog/application/forward-catalog';
import { ADMIN_STOCK_PATTERN, type StockMovementPage } from '@tea/contracts';
import {
  Controller,
  Get,
  Inject,
  Param,
  Query,
  Req,
  Res,
  Patch,
  Body,
  Headers,
} from '@nestjs/common';
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
  MinLength,
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
import { OrdersClient } from '../domain/orders-client';
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
class AdminOrderTransitionDto {
  @IsIn(['SHIPPED', 'COMPLETED', 'CANCELLED']) status!: 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
  @IsIn(ORDER_STATUSES) expectedStatus!: OrderStatus;
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
class MovementPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
}
class AdminOrderIdDto {
  @IsUUID() id!: string;
}
@Controller('api/v1/admin/orders')
@Roles(Role.ADMIN)
export class AdminOrdersController {
  constructor(
    @Inject(OrdersClient) private readonly orders: OrdersClient,
    @Inject(ForwardCatalog) private readonly catalog: ForwardCatalog,
  ) {}
  @Get() list(
    @Query() filters: AdminOrderFiltersDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.orders.request<AdminOrderPage>(ADMIN_ORDERS_PATTERNS.list, {
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
    return this.orders.request<AdminOrderDetail>(ADMIN_ORDERS_PATTERNS.detail, {
      input: params,
      context: {
        userId: request.user!.sub,
        role: request.user!.role,
        correlationId: String(request.id),
      },
    });
  }
  @Patch(':id/status') change(
    @Param() params: AdminOrderIdDto,
    @Body() input: AdminOrderTransitionDto,
    @Headers('idempotency-key') key: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.orders.request<AdminOrderDetail>(ADMIN_ORDERS_PATTERNS.transition, {
      input: { ...input, id: params.id, key },
      context: {
        userId: request.user!.sub,
        role: request.user!.role,
        correlationId: String(request.id),
      },
    });
  }
  @Get(':id/movements') movements(
    @Param() params: AdminOrderIdDto,
    @Query() query: MovementPageDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.catalog.execute<StockMovementPage>(ADMIN_STOCK_PATTERN, {
      input: { orderId: params.id, page: query.page ?? 1 },
      context: {
        userId: request.user!.sub,
        role: request.user!.role,
        correlationId: String(request.id),
      },
    });
  }
}
