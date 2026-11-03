---
name: nextjs-feature
description: Use when building pages, components, forms or admin screens in apps/web (Next.js App Router) for the Tea Element storefront and admin panel.
---

# Next.js feature

Read SPEC.md sections 8, 10 (design) and 11 (API) first.

## Stack and conventions
- Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, lucide-react.
- Server state: TanStack Query. Client state (guest cart, UI): Zustand. Forms: React Hook Form + Zod (same rules as backend DTOs).
- All text through `next-intl` (default locale `uk`). No hardcoded UI strings.
- Colors only via design tokens from SPEC.md section 10 (CSS variables), never raw hex in components.
- Talk only to the gateway API via a typed client in `apps/web/src/lib/api`.

## Structure
`src/app/` routes (thin) · `src/features/<name>/` components, hooks, schemas, api calls · `src/components/ui/` shadcn · `src/lib/` helpers.

## Quality rules
1. Mobile-first and responsive; accessible (labels, focus states, alt text, AA contrast).
2. Skeletons for loading, clear empty and error states, toast for actions.
3. Never trust client prices: display only; server recalculates.
4. Checkout works without login (guest). `/account/*` requires auth, `/admin/*` requires ADMIN (middleware).
5. SEO for public pages: metadata, Open Graph, JSON-LD `Product`.

## Done when
`pnpm lint`, typecheck and build pass; the page works at 375px and 1280px width.
