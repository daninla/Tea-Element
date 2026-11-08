import { Inject, Injectable } from '@nestjs/common';
import { CampaignStore } from '../domain/campaign-store';
@Injectable()
export class RunCampaigns {
  constructor(@Inject(CampaignStore) private readonly store: CampaignStore) {}
  async execute(now = new Date()) {
    await this.store.schedule(now);
    for (let i = 0; i < 10 && (await this.store.deliver(now)); i++) {
      /* Bounded batch. */
    }
  }
}
