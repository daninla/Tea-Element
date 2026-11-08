import type { MarketingEvent } from '@tea/contracts';
export abstract class CampaignStore {
  abstract ingest(event: MarketingEvent): Promise<void>;
  abstract unsubscribe(token: string): Promise<void>;
  abstract schedule(now: Date): Promise<void>;
  abstract deliver(now: Date): Promise<boolean>;
}
export interface CampaignMessage {
  id: string;
  email: string;
  firstName: string;
  unsubscribeUrl: string;
  catalogUrl: string;
}
export abstract class CampaignMailer {
  abstract send(message: CampaignMessage): Promise<void>;
}
