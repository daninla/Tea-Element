import { Inject, Injectable } from '@nestjs/common';
import { CampaignStore, PromotionSource } from '../domain/campaign-store';
@Injectable()
export class SyncPromotions {
  private cursor: string | undefined;
  constructor(
    @Inject(CampaignStore) private readonly store: CampaignStore,
    @Inject(PromotionSource) private readonly source: PromotionSource,
  ) {}
  async execute() {
    if (!(await this.store.enabled('DISCOUNT'))) return;
    for (let i = 0; i < 5; i++) {
      const page = await this.source.list(this.cursor);
      await this.store.syncPromotions(page.items);
      this.cursor = page.nextCursor ?? undefined;
      if (!this.cursor) return;
    }
  }
}
