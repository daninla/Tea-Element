import { Body, Controller, Inject, Post, Req, Res, HttpCode } from '@nestjs/common';
import { IsString, MaxLength, Matches } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { MARKETING_PATTERNS } from '@tea/contracts';
import { Public } from '../../auth/presentation/auth-policy';
import { ForwardMarketing } from '../application/forward-marketing';
class UnsubscribeDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\.[A-Za-z0-9_-]{43}$/)
  token!: string;
}
@Controller('api/v1/marketing')
export class MarketingController {
  constructor(@Inject(ForwardMarketing) private readonly marketing: ForwardMarketing) {}
  @Post('unsubscribe')
  @HttpCode(200)
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  unsubscribe(
    @Body() input: UnsubscribeDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.marketing.execute<{ unsubscribed: true }>(MARKETING_PATTERNS.unsubscribe, {
      input,
      context: { correlationId: String(req.id) },
    });
  }
}
