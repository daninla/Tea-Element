import { z } from 'zod';
import { catalogPrice } from './catalog-schema';
export function localDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine(
    (x) => Number.isFinite(new Date(x).getTime()) && localDateTime(new Date(x).toISOString()) === x,
  );
export const promotionFields = z
  .object({
    name: z.string().trim().min(1).max(200),
    type: z.enum(['PERCENT', 'FIXED']),
    value: z.string(),
    startsAt: date,
    endsAt: date,
    isActive: z.boolean(),
  })
  .superRefine((x, c) => {
    const value =
      x.type === 'FIXED'
        ? catalogPrice.safeParse(x.value)
        : z
            .string()
            .regex(/^\d+$/)
            .transform(Number)
            .pipe(z.number().int().min(1).max(100))
            .safeParse(x.value);
    if (!value.success) c.addIssue({ code: 'custom', path: ['value'], message: 'value' });
    if (new Date(x.startsAt) >= new Date(x.endsAt))
      c.addIssue({ code: 'custom', path: ['endsAt'], message: 'period' });
  })
  .transform((x) => ({
    ...x,
    value: x.type === 'FIXED' ? catalogPrice.parse(x.value) : Number(x.value),
    startsAt: new Date(x.startsAt).toISOString(),
    endsAt: new Date(x.endsAt).toISOString(),
  }));
