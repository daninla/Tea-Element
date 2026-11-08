import { Inject, Injectable } from '@nestjs/common';
import type { CampaignConfiguration } from '@tea/contracts';
import { CampaignStore } from '../domain/campaign-store';
@Injectable()
export class ConfigureCampaign {
  constructor(@Inject(CampaignStore) private readonly store: CampaignStore) {}
  execute(input: CampaignConfiguration, actorId: string) {
    return this.store.configure(input, actorId);
  }
}
