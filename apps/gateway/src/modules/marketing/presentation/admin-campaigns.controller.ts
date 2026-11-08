import {
  Body,
  Controller,
  Get,
  Patch,
  Inject,
  Headers,
  Param,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { IsOptional, IsInt, IsString, IsIn, IsBoolean, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import type { Response } from 'express';
import {
  MARKETING_PATTERNS,
  MARKETING_CAMPAIGNS,
  EMAIL_STATUSES,
  Role,
  type MarketingCampaign,
  type CampaignSetting,
  type MarketingLogPage,
} from '@tea/contracts';
import { Roles, type AuthenticatedRequest } from '../../auth/presentation/auth-policy';
import { ForwardMarketing } from '../application/forward-marketing';
class CampaignParam {
  @IsIn(MARKETING_CAMPAIGNS) campaign!: MarketingCampaign;
}
class Configuration {
  @IsBoolean() enabled!: boolean;
  @IsInt() @Min(0) @Max(2147483646) expectedRevision!: number;
}
class Logs {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page?: number;
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsIn(MARKETING_CAMPAIGNS) campaign?: MarketingCampaign;
  @IsOptional() @IsIn(EMAIL_STATUSES) status?: (typeof EMAIL_STATUSES)[number];
}
function context(r: AuthenticatedRequest) {
  return { userId: r.user!.sub, role: r.user!.role, correlationId: String(r.id) };
}
@Controller('api/v1/admin/campaigns')
@Roles(Role.ADMIN)
export class AdminCampaignsController {
  constructor(@Inject(ForwardMarketing) private readonly marketing: ForwardMarketing) {}
  @Get() get(@Req() r: AuthenticatedRequest, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store');
    return this.marketing.execute<CampaignSetting[]>(MARKETING_PATTERNS.adminRead, {
      input: { kind: 'SETTINGS' },
      context: context(r),
    });
  }
  @Patch(':campaign') configure(
    @Param() p: CampaignParam,
    @Body() body: Configuration,
    @Headers('idempotency-key') key: string,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.marketing.execute<CampaignSetting>(MARKETING_PATTERNS.configure, {
      input: { ...body, campaign: p.campaign, key },
      context: context(r),
    });
  }
}
@Controller('api/v1/admin/email-logs')
@Roles(Role.ADMIN)
export class AdminEmailLogsController {
  constructor(@Inject(ForwardMarketing) private readonly marketing: ForwardMarketing) {}
  @Get() get(
    @Query() q: Logs,
    @Req() r: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.marketing.execute<MarketingLogPage>(MARKETING_PATTERNS.adminRead, {
      input: { ...q, kind: 'LOGS', page: q.page ?? 1 },
      context: context(r),
    });
  }
}
