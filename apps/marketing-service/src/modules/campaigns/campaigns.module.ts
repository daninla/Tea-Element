import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { readEnvironment } from '../../config/environment';
import { PrismaService } from '../../shared/prisma.service';
import { RabbitEventBus } from '../../shared/rabbit-event-bus';
import { CampaignStore, CampaignMailer, PromotionSource } from './domain/campaign-store';
import { RmqPromotionSource } from './infrastructure/rmq-promotion-source';
import { ReadCampaignAdmin } from './application/read-campaign-admin';
import { ConfigureCampaign } from './application/configure-campaign';
import { SyncPromotions } from './application/sync-promotions';
import { AdminCampaignsRpcController } from './presentation/admin-campaigns.controller';
import { PrismaCampaignStore } from './infrastructure/prisma-campaign-store';
import { SmtpCampaignMailer } from './infrastructure/smtp-campaign-mailer';
import { HandleMarketingEvent } from './application/handle-marketing-event';
import { RunCampaigns } from './application/run-campaigns';
import { UnsubscribeMarketing } from './application/unsubscribe-marketing';
import { MarketingWorker } from './presentation/marketing-worker';
import { MarketingRpcController } from './presentation/marketing-rpc.controller';
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'CATALOG_MARKETING_TRANSPORT',
        useFactory: () => ({
          transport: Transport.RMQ,
          options: {
            urls: [readEnvironment().RABBITMQ_URL],
            queue: readEnvironment().CATALOG_RPC_QUEUE,
            queueOptions: { durable: true, messageTtl: 6000 },
            persistent: false,
          },
        }),
      },
    ]),
  ],
  controllers: [MarketingRpcController, AdminCampaignsRpcController],
  providers: [
    PrismaService,
    RabbitEventBus,
    { provide: CampaignStore, useClass: PrismaCampaignStore },
    { provide: CampaignMailer, useClass: SmtpCampaignMailer },
    HandleMarketingEvent,
    RunCampaigns,
    UnsubscribeMarketing,
    MarketingWorker,
    ReadCampaignAdmin,
    ConfigureCampaign,
    SyncPromotions,
    { provide: PromotionSource, useClass: RmqPromotionSource },
  ],
})
export class CampaignsModule {}
