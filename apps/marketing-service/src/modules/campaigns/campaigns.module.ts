import { Module } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma.service';
import { RabbitEventBus } from '../../shared/rabbit-event-bus';
import { CampaignStore, CampaignMailer } from './domain/campaign-store';
import { PrismaCampaignStore } from './infrastructure/prisma-campaign-store';
import { SmtpCampaignMailer } from './infrastructure/smtp-campaign-mailer';
import { HandleMarketingEvent } from './application/handle-marketing-event';
import { RunCampaigns } from './application/run-campaigns';
import { UnsubscribeMarketing } from './application/unsubscribe-marketing';
import { MarketingWorker } from './presentation/marketing-worker';
import { MarketingRpcController } from './presentation/marketing-rpc.controller';
@Module({
  controllers: [MarketingRpcController],
  providers: [
    PrismaService,
    RabbitEventBus,
    { provide: CampaignStore, useClass: PrismaCampaignStore },
    { provide: CampaignMailer, useClass: SmtpCampaignMailer },
    HandleMarketingEvent,
    RunCampaigns,
    UnsubscribeMarketing,
    MarketingWorker,
  ],
})
export class CampaignsModule {}
