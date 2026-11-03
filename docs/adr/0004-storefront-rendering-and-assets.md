# 0004 — Storefront rendering and assets

Status: accepted for stage 3.

## Decision

Use Next.js Server Components for indexable catalog/product content, fresh gateway reads with no-store,
and next-intl for all UI copy. TanStack Query handles client-side search suggestions and cancellation.
The typed API client lives in apps/web/src/lib/api and only contacts the gateway. Client-only UI state
stays local to its owning component; no cart or checkout state is introduced in this browsing milestone.

Add TanStack Query for live suggestions, Zod for URL input validation, and the standard shadcn/ui
primitives (Radix Slot/Dialog, CVA, clsx, tailwind-merge) for composable accessible controls.
Inter and Cormorant Garamond are bundled locally from Google Fonts with their OFL licenses and served
through next/font/local so builds do not depend on font CDN requests.

The palette uses SPEC tokens. Additional semantic contrast tokens may darken text/button surfaces
for WCAG AA while retaining the sage accents. Illustrative generated tea photographs are local assets;
they are never presented as supplier photos. Existing API image URLs take precedence over fallback art.
Prompts and tool provenance are documented with the assets.

## Scope

This milestone enables browsing, search, filters, portion selection and brewing information.
Cart, customer authentication UI and checkout remain their own milestones. No inert purchase button
or imaginary shipping/returns policy is shown. A demo notice explains that ordering is not open.
Local demo pages remain noindex until real data, policy pages and deployment settings are ready.
