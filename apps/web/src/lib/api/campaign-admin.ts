import type {
  CampaignConfiguration,
  CampaignSetting,
  MarketingAdminRead,
  MarketingLogPage,
} from '@tea/contracts';
import { request } from './orders';
export const campaignAdminApi = {
  settings: () => request<CampaignSetting[]>('/admin/campaigns'),
  configure: ({ campaign, key, ...body }: CampaignConfiguration) =>
    request<CampaignSetting>('/admin/campaigns/' + campaign, 'PATCH', body, key),
  logs: (input: Extract<MarketingAdminRead, { kind: 'LOGS' }>) => {
    const p = new URLSearchParams({ page: String(input.page) });
    for (const k of ['q', 'campaign', 'status'] as const) if (input[k]) p.set(k, input[k]);
    return request<MarketingLogPage>('/admin/email-logs?' + p);
  },
};
