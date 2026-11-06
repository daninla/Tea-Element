import {
  Body,
  Controller,
  Get,
  Post,
  HttpCode,
  Inject,
  Headers,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
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
  MaxLength,
  Length,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import type { Response } from 'express';
import {
  ADMIN_PAYMENTS_PATTERNS,
  PAYMENT_STATUSES,
  Role,
  type AdminPaymentStatus,
  type AdminPaymentPage,
  type AdminPaymentDetail,
  type AdminPaymentEvents,
  type AdminPaymentCommands,
  type ReconciliationReceipt,
} from '@tea/contracts';
import { ForwardPayments } from '../application/forward-payments';
import { Roles, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
const boolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;
class Page {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
}
class List extends Page {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(PAYMENT_STATUSES) status?: AdminPaymentStatus;
  @IsOptional() @IsIn(['FAKE', 'LIQPAY']) provider?: 'FAKE' | 'LIQPAY';
  @IsOptional() @Transform(boolean) @IsBoolean() refundOnly?: boolean;
  @IsOptional() @IsISO8601({ strict: true }) from?: string;
  @IsOptional() @IsISO8601({ strict: true }) to?: string;
}
class Events extends Page {
  @IsOptional() @IsUUID() paymentId?: string;
  @IsOptional() @Transform(boolean) @IsBoolean() signatureValid?: boolean;
}
class Id {
  @IsUUID() id!: string;
}
class Reconcile {
  @IsIn(PAYMENT_STATUSES) expectedStatus!: AdminPaymentStatus;
  @IsString() @Length(3, 500) reason!: string;
}
function context(r: AuthenticatedRequest) {
  return { userId: r.user!.sub, role: r.user!.role, correlationId: String(r.id) };
}
@Controller('api/v1/admin/payments')
@Roles(Role.ADMIN)
export class AdminPaymentsController {
  constructor(@Inject(ForwardPayments) private readonly payments: ForwardPayments) {}
  @Get() list(
    @Query() x: List,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.payments.execute<AdminPaymentPage>(ADMIN_PAYMENTS_PATTERNS.read, {
      input: { ...x, kind: 'LIST', page: x.page ?? 1 },
      context: context(r),
    });
  }
  @Get('events') events(
    @Query() x: Events,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.payments.execute<AdminPaymentEvents>(ADMIN_PAYMENTS_PATTERNS.read, {
      input: { ...x, kind: 'EVENTS', page: x.page ?? 1 },
      context: context(r),
    });
  }
  @Get(':id') detail(
    @Param() x: Id,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.payments.execute<AdminPaymentDetail>(ADMIN_PAYMENTS_PATTERNS.read, {
      input: { kind: 'DETAIL', id: x.id },
      context: context(r),
    });
  }
  @Get(':id/commands') commands(
    @Param() x: Id,
    @Query() q: Page,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.payments.execute<AdminPaymentCommands>(ADMIN_PAYMENTS_PATTERNS.read, {
      input: { kind: 'COMMANDS', id: x.id, page: q.page ?? 1 },
      context: context(r),
    });
  }
  @Post(':id/reconcile') @HttpCode(202) reconcile(
    @Param() x: Id,
    @Body() body: Reconcile,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.payments.execute<ReconciliationReceipt>(ADMIN_PAYMENTS_PATTERNS.reconcile, {
      input: { ...body, paymentId: x.id, key },
      context: context(r),
    });
  }
}
