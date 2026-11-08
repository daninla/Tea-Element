import { z } from 'zod';
import { MARKETING_CAMPAIGNS, EMAIL_STATUSES } from '@tea/contracts';
export const campaignFilterFields = z
  .object({
    q: z.string().trim().max(100),
    campaign: z.enum(['', ...MARKETING_CAMPAIGNS]),
    status: z.enum(['', ...EMAIL_STATUSES]),
  })
  .strict();
