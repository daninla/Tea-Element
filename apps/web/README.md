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
Customer accounts are implemented in stage 5; the administrator order workspace is stage 6.1/6.2. Metadata and Product JSON-LD are included;
robots remain noindex until deployment and real store content are ready.

## Verification

`pnpm --filter @tea/web test` runs 81 tests for URL validation/pagination, portion selection,
structured-data escaping, SSR-safe money formatting, persisted carts, checkout validation and replay
metadata recovery. Root lint, typecheck, test, build and format
checks also cover this application. Browser checks at 375px/1280px cover filters, search suggestions,
pagination, gallery, unavailable portions, cart persistence/quantities, checkout validation, delivery and
pickup order creation, confirmation and cancellation; no horizontal document overflow was found.

Navigation regressions also cover search → product → all tea → apply filters, immediate hiding of
old suggestions, URL query restoration and resetting unapplied filter edits. Browser checks repeat
the reported sequence on desktop/mobile, ascending prices across both pages, descending prices and
returning to the first page when changing sort.

## Equipment section

`/teaware` contains teaware and accessory filters and is linked from navigation, footer and the homepage.
Tea catalog remains `/catalog`; header search explicitly uses `section=ALL` so equipment is searchable.
Equipment detail/cart/checkout/order views show pieces, no gram weight/query parameter and no brewing
guide. Filter submissions, resets and pagination stay within the selected section. The four new generated
photos and full prompts are documented in [equipment provenance](public/images/equipment-prompts.md).
No supplier claims or real purchase/fulfillment are implied by these demonstration products.

## Storefront payments (stage 4a.3)

Checkout offers demonstration online/COD choice. Online orders wait for reservation on
/order/[number]/pay; /order/[number]/result shows success only after orders RPC confirms PAID.
Private access restores per order from same-tab sessionStorage; URL result flags never confirm payment.
Hosted LiqPay forms contain only data/signature and preserve the private token locally. Navigation is
blocked if guest storage cannot preserve access. Fake mode exposes explicit offline success/refusal
controls, never a card form. Authenticated ownership works through the same private gateway boundary.

Failure offers idempotent retry or COD switch without extending the reservation. Errors, pending states
and bounded preparation retries are localized. Browser checks at 375/1280px cover refusal/retry/success,
refresh without URL bearer, mixed tea/equipment COD switch/cancellation and forged success flags.
No horizontal overflow or payment-flow console error was observed. Real merchant sandbox acceptance
remains external; live keys/real charges are disabled. See ADR 0010.

## Customer account (stage 5)

`features/account` backs thin /login, /register, /forgot-password, /reset-password, /verify-email,
/order-lookup and /account routes. Forms use RHF/Zod with localized Ukrainian copy. Email proofs stay
in URL fragments until explicit submission. The browser uses HttpOnly cookies and serialized refresh,
including Web Locks across tabs. Private order history is owner-scoped, paginated and periodically refreshed.
Repeat-order actions request fresh server prices/stock. Profile delivery prefills untouched checkout fields.
Middleware only provides a redirect; gateway authentication is the security boundary. See ADR 0011.

## Admin order workspace (stage 6.1)

`(store)` groups existing public/account routes under their unchanged URLs and storefront layout.
`/admin/orders` and `/admin/orders/[id]` use a separate sidebar/topbar. ADMIN middleware verifies through
the gateway; it fails closed on 403/503 and returns expired sessions to login for serialized refresh.
The client shell separately gates rendering by current role. Filters are URL state; calendar dates are
inclusive local browser days and order times display in Europe/Kyiv. The workspace currently supports
reads plus the stage 6.2 fulfillment actions below; see ADR 0012 for the initial read workspace.

## Fulfillment UI (stage 6.2)

Admin cards expose eligible shipment/completion actions, require reason plus explicit confirmation and
retain a command key for uncertain retries. Pending warehouse deduction is polled and blocks completion.
COD completion explicitly confirms collection. Actor audit and paginated stock movements appear in the
card. Customer tracking displays confirmed COD collection correctly. Carrier dispatch/real collection
are not automated. See ADR 0013.

## Inventory workspace (stage 6.3)

`/admin/inventory` lists physical/reserved/available quantities with URL filters. Product cards provide
purchase and adjustment/write-off forms, explicit confirmation and paginated movement/batch history.
Hryvnia input converts exactly to integer kopecks. The server chooses stock units and enforces reserve
bounds and optimistic balance checks. Pending command key/fingerprint metadata survives same-tab reloads;
changed uncertain operations require explicit history review and clearing prior inputs. Logout clears
metadata. Browser acceptance covers 375/1280px without horizontal document overflow. See ADR 0014.
