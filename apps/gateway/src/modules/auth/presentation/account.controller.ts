import { Body, Controller, Inject, Post, Patch, Req, Res, HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import {
  IsString,
  Length,
  IsEmail,
  MaxLength,
  IsOptional,
  IsBoolean,
  Matches,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { Throttle } from '@nestjs/throttler';
import { AUTH_PATTERNS, type PublicUser, type AuthSession } from '@tea/contracts';
import { ForwardAuth } from '../application/forward-auth';
import { Public, type AuthenticatedRequest } from './auth-policy';
import { setSession, clearSession } from './auth-cookies';
import { DeliveryDto } from '../../orders/presentation/orders.dto';
class EmailDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(320)
  email!: string;
}
class TokenDto {
  @IsString() @MaxLength(100) token!: string;
}
class ResetDto extends TokenDto {
  @IsString() @Length(8, 128) password!: string;
}
class FromOrderDto {
  @Matches(/^TE-[A-F0-9]{32}$/) number!: string;
  @Matches(/^[A-Za-z0-9_-]{43}$/) token!: string;
  @IsString() @Length(8, 128) password!: string;
  @IsOptional() @IsBoolean() marketingConsent?: boolean;
}
class ProfileDto {
  @IsString() @Length(1, 100) firstName!: string;
  @IsString() @Length(1, 100) lastName!: string;
  @ValidateIf((x: ProfileDto) => x.phone !== null) @Matches(/^\+380\d{9}$/) phone!: string | null;
  @ValidateIf((x: ProfileDto) => x.defaultDelivery !== null)
  @ValidateNested()
  @Type(() => DeliveryDto)
  defaultDelivery!: DeliveryDto | null;
}
@Controller('api/v1/auth')
export class AccountController {
  constructor(@Inject(ForwardAuth) private readonly auth: ForwardAuth) {}
  @Post('email/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  requestEmail(@Req() r: AuthenticatedRequest) {
    return this.auth.execute(AUTH_PATTERNS.requestEmail, {
      input: { userId: r.user!.sub },
      context: { correlationId: String(r.id) },
    });
  }
  @Public()
  @Post('email/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  confirm(@Body() input: TokenDto, @Req() r: AuthenticatedRequest) {
    return this.auth.execute(AUTH_PATTERNS.confirmEmail, {
      input,
      context: { correlationId: String(r.id) },
    });
  }
  @Public()
  @Post('password/request')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  requestPassword(@Body() input: EmailDto, @Req() r: AuthenticatedRequest) {
    return this.auth.execute(AUTH_PATTERNS.requestPassword, {
      input,
      context: { correlationId: String(r.id) },
    });
  }
  @Public()
  @Post('password/reset')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async reset(
    @Body() input: ResetDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.execute(AUTH_PATTERNS.resetPassword, {
      input,
      context: { correlationId: String(r.id) },
    });
    clearSession(res);
    return result;
  }
  @Public()
  @Post('register-from-order')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(
    @Body() input: FromOrderDto,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return setSession(
      res,
      await this.auth.execute<AuthSession>(AUTH_PATTERNS.registerFromOrder, {
        input,
        context: { correlationId: String(r.id) },
      }),
    );
  }
  @Patch('profile') profile(@Body() profile: ProfileDto, @Req() r: AuthenticatedRequest) {
    return this.auth.execute<PublicUser>(AUTH_PATTERNS.profile, {
      input: { userId: r.user!.sub, profile },
      context: { correlationId: String(r.id) },
    });
  }
}
