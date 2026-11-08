import type {
  MarketingEvent,
  MarketingAdminRead,
  CampaignConfiguration,
  CampaignSetting,
  MarketingLogPage,
  MarketingPromotion,
  MarketingPromotionPage,
  MarketingCampaign,
} from '@tea/contracts';
export abstract class CampaignStore {
  abstract ingest(event: MarketingEvent): Promise<void>;
  abstract unsubscribe(token: string): Promise<void>;
  abstract schedule(now: Date): Promise<void>;
  abstract deliver(now: Date): Promise<boolean>;
  abstract enabled(campaign: MarketingCampaign): Promise<boolean>;
  abstract syncPromotions(items: MarketingPromotion[]): Promise<void>;
  abstract readAdmin(input: MarketingAdminRead): Promise<CampaignSetting[] | MarketingLogPage>;
  abstract configure(input: CampaignConfiguration, actorId: string): Promise<CampaignSetting>;
}
export abstract class PromotionSource {
  abstract list(after?: string): Promise<MarketingPromotionPage>;
}
export interface CampaignMessage {
  id: string;
  email: string;
  firstName: string;
  unsubscribeUrl: string;
  catalogUrl: string;
  campaign?: MarketingCampaign;
  promotionTitle?: string;
}
export abstract class CampaignMailer {
  abstract send(message: CampaignMessage): Promise<void>;
}
