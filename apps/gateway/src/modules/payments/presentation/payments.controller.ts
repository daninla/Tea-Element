import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Query,
  Req,
  Param,
  SetMetadata,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { PAYMENTS_PATTERNS, type PaymentView, type PaymentCheckoutView } from '@tea/contracts';
import {
  Public,
  OptionalAuth,
  type AuthenticatedRequest,
} from '../../auth/presentation/auth-policy';
import { ForwardPayments } from '../application/forward-payments';
export class PaymentAccessDto {
  @Matches(/^TE-[A-F0-9]{32}$/) number!: string;
  @IsOptional() @Matches(/^[A-Za-z0-9_-]{43}$/) token?: string;
}
export class ProviderDto {
  @IsIn(['fake', 'liqpay']) provider!: 'fake' | 'liqpay';
}
export class WebhookDto {
  @IsString() @MaxLength(65536) data!: string;
  @IsString() @MaxLength(128) signature!: string;
}
@Controller('api/v1/payments')
export class PaymentsController {
  constructor(@Inject(ForwardPayments) private readonly payments: ForwardPayments) {}
  @Public()
  @OptionalAuth()
  @Post('checkout')
  @HttpCode(200)
  checkout(@Body() input: PaymentAccessDto, @Req() req: AuthenticatedRequest) {
    return this.payments.execute<PaymentCheckoutView>(PAYMENTS_PATTERNS.checkout, {
      input,
      context: { correlationId: String(req.id), userId: req.user?.sub },
    });
  }
  @Public()
  @OptionalAuth()
  @Get('status')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  status(@Query() input: PaymentAccessDto, @Req() req: AuthenticatedRequest) {
    return this.payments.execute<PaymentView>(PAYMENTS_PATTERNS.status, {
      input,
      context: { correlationId: String(req.id), userId: req.user?.sub },
    });
  }
  @Public()
  @Post('webhook/:provider')
  @HttpCode(200)
  @SetMetadata('tea.provider_callback', true)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  webhook(@Param() param: ProviderDto, @Body() raw: WebhookDto, @Req() req: AuthenticatedRequest) {
    return this.payments.execute(PAYMENTS_PATTERNS.webhook, {
      input: { provider: param.provider, data: raw.data, signature: raw.signature },
      context: { correlationId: String(req.id) },
    });
  }
}
