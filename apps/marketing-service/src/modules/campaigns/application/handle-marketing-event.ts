import { Inject, Injectable } from '@nestjs/common';
import type { MarketingEvent } from '@tea/contracts';
import { CampaignStore } from '../domain/campaign-store';
@Injectable()
export class HandleMarketingEvent {
  constructor(@Inject(CampaignStore) private readonly store: CampaignStore) {}
  execute(event: MarketingEvent) {
    return this.store.ingest(event);
  }
}
