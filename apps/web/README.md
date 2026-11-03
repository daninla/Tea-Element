# Web

Next.js 15 App Router Ukrainian storefront and guest checkout (stage 4). Start all applications with `pnpm dev`, or use
`pnpm --filter @tea/web dev` on port 3000 with the gateway/catalog already running. Seed demo data with
`pnpm db:seed`. `GET /health` reports liveness.

## Routes and behavior

- `/`: categories, current promotions, recent teas and brewing introduction.
- `/catalog`, `/catalog/[category]`: search, category, origin, price, sale/stock, sorting and pagination.
- `/product/[slug]`: gallery, portion prices/availability, quantities, add-to-cart and brewing guidance.
- `/cart`: persistent portions, quantities/removal, fresh prices and stock, header mini-cart drawer.
- `/checkout`: guest contact/delivery/pickup form, optional marketing consent, COD demonstration order.
- `/order/[number]?token=`: private tracking, status polling and cancellation.
- `/terms`: local demonstration/test-data conditions, not real store terms.

Catalog state lives in URL query parameters. UI `minPrice`/`maxPrice` are hryvnia decimals converted
exactly into integer kopecks for the gateway; its public API always uses kopecks. `weight` on product
URLs selects grams. Cart state stores IDs/quantities through Zustand persist. Prices come from server quotes every 30
seconds and before checkout; changed prices require review. Checkout uses RHF/Zod and retains a UUID
idempotency key plus a SHA-256 fingerprint in sessionStorage after uncertain responses. No contact
plaintext is stored in attempt metadata.
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

All orders are demonstrations without payment or fulfillment, with an explicit notice. The checkout
works without an account. Existing authenticated sessions are detected, guest items merge idempotently
into the server cart, and subsequent changes synchronize. Edits during synchronization are reconciled.
Customer login/account UI and admin screens remain later milestones. Metadata and Product JSON-LD are included;
robots remain noindex until deployment and real store content are ready.

## Verification

`pnpm --filter @tea/web test` runs 55 tests for URL validation/pagination, portion selection,
structured-data escaping, SSR-safe money formatting, persisted carts, checkout validation and replay
metadata recovery. Root lint, typecheck, test, build and format
checks also cover this application. Browser checks at 375px/1280px cover filters, search suggestions,
pagination, gallery, unavailable portions, cart persistence/quantities, checkout validation, delivery and
pickup order creation, confirmation and cancellation; no horizontal document overflow was found.
