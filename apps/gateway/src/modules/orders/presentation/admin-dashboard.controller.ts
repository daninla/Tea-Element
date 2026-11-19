import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Type } from 'class-transformer';
import { IsOptional, IsIn } from 'class-validator';
import {
  ADMIN_DASHBOARD_PATTERN,
  Role,
  type AdminDashboard,
  type DashboardDays,
} from '@tea/contracts';
import { OrdersClient } from '../domain/orders-client';
import { Roles, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
class DashboardDto {
  @IsOptional() @Type(() => Number) @IsIn([1, 7, 30]) days?: DashboardDays;
}
@Controller('api/v1/admin/dashboard')
@Roles(Role.ADMIN)
export class AdminDashboardController {
  constructor(@Inject(OrdersClient) private readonly orders: OrdersClient) {}
  @Get() read(
    @Query() input: DashboardDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Cache-Control', 'no-store');
    return this.orders.request<AdminDashboard>(ADMIN_DASHBOARD_PATTERN, {
      input: { days: input.days ?? 7 },
      context: {
        userId: request.user!.sub,
        role: request.user!.role,
        correlationId: String(request.id),
      },
    });
  }
}
