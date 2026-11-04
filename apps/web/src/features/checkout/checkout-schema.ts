import { z } from 'zod';
export const checkoutSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: z.string().regex(/^\+380\d{9}$/),
  email: z.string().trim().email().max(320),
  delivery: z
    .object({
      method: z.enum(['NOVA_POSHTA_BRANCH', 'NOVA_POSHTA_COURIER', 'PICKUP']),
      city: z.string().trim().max(100),
      address: z.string().trim().max(300),
    })
    .superRefine((x, ctx) => {
      if (x.method !== 'PICKUP') {
        if (x.city.length < 2)
          ctx.addIssue({ code: 'custom', path: ['city'], message: 'required' });
        if (x.address.length < 2)
          ctx.addIssue({ code: 'custom', path: ['address'], message: 'required' });
      }
    }),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'ONLINE_CARD']),
  comment: z.string().trim().max(1000),
  marketingConsent: z.boolean(),
  acceptTerms: z.boolean().refine((x) => x === true),
});
export type CheckoutFields = z.infer<typeof checkoutSchema>;
