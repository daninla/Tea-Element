import { z } from 'zod';
export function safeAccountNext(value: string | null) {
  if (value === '/admin/payments/events') return value;
  if (
    value &&
    /^\/admin\/customers(?:\/(?:accounts\/[0-9a-f-]{36}|guest))?(?:\?[A-Za-z0-9%=&+_.@-]*)?$/.test(
      value,
    )
  )
    return value;
  if (
    value &&
    /^\/admin(?:\/(?:orders|inventory|products|categories|promotions|payments)(?:\/(?:[0-9a-f-]{36}|new))?)?(?:\?[A-Za-z0-9%=&+_.-]*)?$/.test(
      value,
    )
  )
    return value;
  return value === '/checkout' || value === '/cart' ? value : '/account';
}
export const authFields = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(8).max(128),
});
export const signupFields = authFields
  .extend({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z
      .string()
      .regex(/^\+380\d{9}$/)
      .or(z.literal('')),
    confirmPassword: z.string(),
    marketingConsent: z.boolean(),
    acceptTerms: z.literal(true),
  })
  .refine((x) => x.password === x.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });
export const profileFields = z
  .object({
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    phone: z
      .string()
      .regex(/^\+380\d{9}$/)
      .or(z.literal('')),
    saveDelivery: z.boolean(),
    delivery: z.object({
      method: z.enum(['PICKUP', 'NOVA_POSHTA_BRANCH', 'NOVA_POSHTA_COURIER']),
      city: z.string().trim().max(100),
      address: z.string().trim().max(300),
    }),
  })
  .refine(
    (x) =>
      !x.saveDelivery ||
      x.delivery.method === 'PICKUP' ||
      (x.delivery.city.length >= 2 && x.delivery.address.length >= 2),
    { path: ['delivery'], message: 'delivery' },
  );
