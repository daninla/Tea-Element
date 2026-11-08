import { Inject, Injectable } from '@nestjs/common';
import type { MarketingAdminRead } from '@tea/contracts';
import { CampaignStore } from '../domain/campaign-store';
@Injectable()
export class ReadCampaignAdmin {
  constructor(@Inject(CampaignStore) private readonly store: CampaignStore) {}
  execute(input: MarketingAdminRead) {
    return this.store.readAdmin(input);
  }
}
