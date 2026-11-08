import { Inject, Injectable } from '@nestjs/common';
import { CampaignStore } from '../domain/campaign-store';
@Injectable()
export class UnsubscribeMarketing {
  constructor(@Inject(CampaignStore) private readonly store: CampaignStore) {}
  execute(token: string) {
    return this.store.unsubscribe(token);
  }
}
