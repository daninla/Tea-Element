import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import type { CartItemInput } from '@tea/contracts';
export const storedCart = z
  .array(
    z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }).strict(),
  )
  .max(50)
  .refine((items) => new Set(items.map((x) => x.variantId)).size === items.length);
export function addCartItem(
  items: CartItemInput[],
  variantId: string,
  quantity: number,
): CartItemInput[] {
  const current = items.find((x) => x.variantId === variantId);
  if (!current && items.length >= 50) return items;
  return current
    ? items.map((x) =>
        x.variantId === variantId ? { ...x, quantity: Math.min(99, x.quantity + quantity) } : x,
      )
    : [...items, { variantId, quantity: Math.min(99, Math.max(1, quantity)) }];
}
interface CartState {
  items: CartItemInput[];
  revision: number;
  ownerId: string | null;
  add: (variantId: string, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
  replace: (items: CartItemInput[], ownerId?: string | null) => void;
}
export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      revision: 0,
      ownerId: null,
      add: (variantId, quantity) =>
        set((s) => ({
          items: addCartItem(s.items, variantId, quantity),
          revision: s.revision + 1,
        })),
      setQuantity: (variantId, quantity) =>
        set((s) => ({
          items: s.items.map((x) =>
            x.variantId === variantId ? { ...x, quantity: Math.min(99, Math.max(1, quantity)) } : x,
          ),
          revision: s.revision + 1,
        })),
      remove: (variantId) =>
        set((s) => ({
          items: s.items.filter((x) => x.variantId !== variantId),
          revision: s.revision + 1,
        })),
      clear: () => set((s) => ({ items: [], revision: s.revision + 1 })),
      replace: (items, ownerId) =>
        set((s) => ({
          items,
          ownerId: ownerId === undefined ? s.ownerId : ownerId,
          revision: s.revision + 1,
        })),
    }),
    {
      name: 'tea-guest-cart-v1',
      partialize: ({ items, ownerId }) => ({ items, ownerId }),
      merge: (persisted, current) => {
        const state = persisted as { items?: unknown; ownerId?: unknown } | undefined;
        const parsed = storedCart.safeParse(state?.items);
        return {
          ...current,
          items: parsed.success ? parsed.data : [],
          ownerId: typeof state?.ownerId === 'string' ? state.ownerId : null,
        };
      },
    },
  ),
);

export function reconcileCart(
  server: CartItemInput[],
  before: CartItemInput[],
  current: CartItemInput[],
): CartItemInput[] {
  const result = new Map(server.map((x) => [x.variantId, x.quantity]));
  for (const id of new Set([...before, ...current].map((x) => x.variantId))) {
    const delta =
      (current.find((x) => x.variantId === id)?.quantity ?? 0) -
      (before.find((x) => x.variantId === id)?.quantity ?? 0);
    if (delta) {
      const quantity = Math.min(99, Math.max(0, (result.get(id) ?? 0) + delta));
      if (quantity) result.set(id, quantity);
      else result.delete(id);
    }
  }
  return [...result].slice(0, 50).map(([variantId, quantity]) => ({ variantId, quantity }));
}
