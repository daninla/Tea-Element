import { Controller, Get, Inject, Param, Query, Req, Res } from '@nestjs/common';
import { IsOptional, IsInt, IsString, IsUUID, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import {
  ADMIN_CUSTOMERS_PATTERNS,
  Role,
  type CustomerAccount,
  type CustomerAccountPage,
} from '@tea/contracts';
import { ForwardAuth } from '../application/forward-auth';
import { Roles, type AuthenticatedRequest } from './auth-policy';
class Filters {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
}
class Id {
  @IsUUID() id!: string;
}
function context(r: AuthenticatedRequest) {
  return { userId: r.user!.sub, role: r.user!.role, correlationId: String(r.id) };
}
@Controller('api/v1/admin/customers/accounts')
@Roles(Role.ADMIN)
export class CustomerAccountsController {
  constructor(@Inject(ForwardAuth) private readonly auth: ForwardAuth) {}
  @Get() list(
    @Query() x: Filters,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.auth.execute<CustomerAccountPage>(ADMIN_CUSTOMERS_PATTERNS.accounts, {
      input: { kind: 'LIST', page: x.page ?? 1, q: x.q },
      context: context(r),
    });
  }
  @Get(':id') detail(
    @Param() x: Id,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.auth.execute<CustomerAccount>(ADMIN_CUSTOMERS_PATTERNS.accounts, {
      input: { kind: 'DETAIL', id: x.id },
      context: context(r),
    });
  }
}
