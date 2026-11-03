# Web

Next.js 15 App Router Ukrainian storefront (stage 3). Start all applications with `pnpm dev`, or use
`pnpm --filter @tea/web dev` on port 3000 with the gateway/catalog already running. Seed demo data with
`pnpm db:seed`. `GET /health` reports liveness.

## Routes and behavior

- `/`: categories, current promotions, recent teas and brewing introduction.
- `/catalog`, `/catalog/[category]`: search, category, origin, price, sale/stock, sorting and pagination.
- `/product/[slug]`: gallery, portion prices/availability, brewing guidance and related teas.

Catalog state lives in URL query parameters. UI `minPrice`/`maxPrice` are hryvnia decimals converted
exactly into integer kopecks for the gateway; its public API always uses kopecks. `weight` on product
URLs selects grams. Selection changes displayed API prices only; no purchase is submitted.
Search suggestions use TanStack Query with cancellation; page content is server-rendered with fresh
`no-store` gateway reads and a bounded timeout. Loading, empty, invalid-query, not-found and retryable
error states are localized. Mobile filters use a Radix dialog with focus management.

`INTERNAL_API_URL` is the server gateway origin (default `http://localhost:4000`). Browser suggestions
use `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`). `NEXT_PUBLIC_SITE_URL` supplies the
metadata origin. Never put credentials in public variables. All public catalog requests omit credentials.

## Design and scope

Copy lives in `messages/uk.json`; locale configuration in `src/i18n/request.ts`. CSS colors use SPEC
and semantic contrast tokens. Inter/Cormorant Garamond are bundled with OFL licenses. Generated local
photos are illustrative; see [asset provenance](public/images/README.md) and
[ADR 0004](../../docs/adr/0004-storefront-rendering-and-assets.md).

This is a browsing milestone with demonstration data and a visible ordering notice. No cart,
checkout, customer login UI or admin screen is presented. Metadata and Product JSON-LD are included;
robots remain noindex until deployment and real store content are ready.

## Verification

`pnpm --filter @tea/web test` runs 28 tests for URL validation/pagination, portion selection,
structured-data escaping and SSR-safe money formatting. Root lint, typecheck, test, build and format
checks also cover this application. Browser checks at 375px/1280px cover filters, search suggestions,
pagination, gallery and unavailable portions; no horizontal document overflow was found.
