# Implementation status

## Stage 0 — foundation

Implemented: pnpm workspace, Turbo task graph, strict TypeScript, shared ESLint configuration,
Prettier, Husky/lint-staged/Commitlint, Nest CLI monorepo mapping, six NestJS HTTP processes,
liveness endpoints, environment validation, Pino correlation IDs and redaction, Helmet, Swagger,
graceful shutdown, localized Next.js foundation page, PostgreSQL/RabbitMQ/Redis/Mailpit Compose,
optional container application override, shared operational contracts, HTTP tests and CI.

## Stage 1 — authentication

Implemented: Prisma auth schema/migration, Argon2id passwords, CUSTOMER registration, login,
15-minute access JWT, hashed seven-day refresh sessions, atomic rotation, family replay revocation,
logout, public profile, cookie/Origin protection, gateway JwtAuthGuard/RolesGuard, ADMIN-only session
endpoint, in-process rate limiting, safe errors, random private development secrets, idempotent admin
seed, RMQ request-response and confirmed UserRegistered Outbox publication.

Integration exercises real HTTP → RMQ → auth → PostgreSQL, concurrent/replayed refresh, expiry,
logout, tampered JWT, RBAC, cookie flags, CSRF, rate limiting, transaction rollback and durable event
publication. A dedicated test database and broker namespace isolate test data.

Explicit follow-up scope: forgot/reset-password and email verification; Next auth forms/middleware;
verified guest linking; shared production rate-limit storage; marketing event consumers. No such
endpoint or UI is presented as implemented.

## Stage 2 — public catalog

Implemented: isolated catalog Prisma schema/migration, 7 categories, 12 demo teas, 36 active portions,
shared gram inventory, 2 seed promotions and read-only catalog RPC via gateway. Public endpoints
provide categories/counts, product details and bounded search/category/origin/price/sale/stock filters,
newest/popular/price sorting and deterministic pagination. Product visibility excludes inactive rows.
Price sorting/filtering and public display agree on current best-single-discount prices in kopecks.

PostgreSQL/RMQ/HTTP integration verifies clean migration deployment, repeatable seed without resetting
edited prices/reservations, discount SQL/domain parity, hidden rows, validation, sorting, literal search,
empty/beyond-end pages and portion availability. No auth is required for catalog reads.

Remaining catalog work: reservation saga/consumer (stage 4), procurement
and inventory journal/admin mutations (stage 6), sales projection and cache invalidation/hardening.
No catalog event producer is claimed; seed data does not emit business events.

## Stage 3 — storefront

Implemented: Ukrainian storefront layout, local Inter/Cormorant typography, design tokens and accessible
Radix controls; homepage with categories, current promotions and recent teas; server-rendered catalog,
category routes, URL-based search/filter/sort/pagination and live search suggestions; product gallery,
portion-specific prices/availability, brewing guidance and related teas. All reads use the typed gateway
client. Category/product metadata and escaped Product JSON-LD are included; demo pages remain noindex.
Loading, empty, invalid-filter, not-found and gateway-error states are provided. Illustrative generated
photos are bundled locally with provenance. Money formatting is deterministic across SSR and browsers.

Browser checks covered 375px and 1280px layouts without horizontal overflow, desktop price/category/sale
filters, mobile filter dialog submission, search suggestions and results, pagination, gallery selection,
portion URLs and unavailable portions. Checkout and customer authentication UI are still outside this
milestone. The demo notice states that ordering is not open.

## Stage 4 — carts and guest orders

Implemented: persisted guest cart, header counter/drawer, quantities/removal, fresh server quotes and
price-change review, guest checkout with Ukrainian validation, manual delivery/pickup and optional
marketing consent, private order tracking/status polling and cancellation. Authenticated API clients
have isolated server carts with idempotent guest merges and can create/read their own orders.
Customer login/account screens remain stage 5; the storefront detects sessions issued by the existing API.

Orders own a separate Prisma database, immutable price/contact/delivery snapshots, hashed guest access,
idempotency fingerprints, status history and transactional Outbox. Catalog reserves all grams atomically,
publishes success/failure via Outbox and tracks processed events. Cancellation and five-minute pending
expiry compensate reservations; a cancellation tombstone prevents late creation from reserving stock.
Confirmed COD orders retain reserved grams; shipping/physical stock deduction remains administration.
A durable SMTP worker sends the private link to local Mailpit. The storefront explicitly identifies all
orders as demonstration data without real payment or fulfillment. Demo terms describe test-data storage.

Real HTTP/RMQ/PostgreSQL integration covers clean migrations, repeatable seeds, current discounts,
validation, concurrent duplicate submissions, request conflicts, missing/wrong tokens, ownership,
idempotent cart merge, reservation duplicates/reordering, rollback on Outbox failure, competing orders
without oversell, rejection, cancellation, timeout, SMTP receipt and retry/DLQ quarantine. Browser checks
at 375px/1280px cover drawer, persistent cart, quantities, form errors, delivery and pickup checkout,
confirmation, cancellation and no horizontal document overflow. No browser console errors were observed
in the completed purchase/cancellation flow.

## Stage 4a.1 — payment provider adapters

Implemented: internal PaymentProvider port, registered offline Fake and LiqPay sandbox adapters,
hosted POST form generation, current API v7/SHA3-256 signatures, timing-safe callback verification,
merchant/attempt/amount/currency checks, exact decimal conversion, bounded status/full-refund requests
and normalized observations without card/contact data. Fake supports success/refusal, duplicate callback
parsing, lost-callback status reads and replayed full refunds. No external call is made by tests/demo.

The provider-only checkpoint is documented in ADR 0008; the next increment adds durable workflow.

## Stage 4a.2 — durable payment backend

Implemented: isolated Prisma payment ledger, raw callback audit, refund jobs, cancellation tombstones,
transactional Outbox and processed-event consumers. Successful online reservation commits
AWAITING_PAYMENT and PaymentRequested; verified success commits PAID/OrderPaid. Gateway checkout/status
revalidate guest token or authenticated ownership through orders RPC. Only signed provider callbacks
bypass browser Origin checks. Client amounts/redirects are rejected.

Callbacks audit before rejection and apply semantic idempotency under order locks. Reconciliation,
30-minute expiry, independent order timeout and late-success refunds compensate stock/payment races.
Refund-before-success cannot regress either ledger or order. Durable claims quarantine ambiguous
refunds for review rather than retrying external side effects blindly. Fake state remains process-local,
while the ledger/audit/jobs persist. No real merchant sandbox request or live payment is claimed.

The new real gateway/RMQ/PostgreSQL suite covers fresh migrations, private guest/owner access, invalid
callback audit, concurrent replay, atomic Outbox rollback, deadlines/stock release, late refund/reordering,
lost callback reconciliation and cancellation/refund idempotency. See ADR 0009. Storefront checkout
continues to offer demonstration COD; online UI, retry/COD-switch and multi-attempt policy are next.

## Stage 4a.3 — storefront payment flow and multiple attempts

Implemented: online/COD checkout choice, preparation/result pages, server-confirmed outcome polling,
per-order same-tab guest-token restoration, guarded hosted POST form and explicit offline success/refusal
controls. Failed active attempts can retry with an idempotent command or switch to COD while preserving
the original reservation deadline. Multiple attempts and abandonment tombstones persist independently;
late historical outcomes cannot change a newer attempt or COD order. Existing order/payment rows remain
compatible through lazy order-side attempt history recovery. See ADR 0010.

Real integration adds concurrent command replay, conflict, unchanged deadlines, legacy recovery, COD
switch and late abandoned-attempt refunds. Browser acceptance at 375/1280px covers online choice,
refusal/retry/success, refresh without URL bearer, mixed orders, COD/cancellation and forged result flags.
There is no horizontal document overflow or payment-flow console error. Live payments remain disabled;
merchant LiqPay sandbox acceptance has not been performed without the owner's account configuration.

## Stage 5 — customer account

Implemented: login/registration, cookie-session refresh, logout, one-use email confirmation and password
recovery, profile/default delivery, private paginated order history and repeat-order cart quotes.
Registration from a private guest order takes its trusted contact snapshot. Neutral email lookup resends
access only to the stored matching address. Guest orders link only after proof, through transactional
UserEmailVerified Outbox and an idempotent orders consumer with reconciliation and a proof-time cutoff.
Later guest purchases require another confirmation. See ADR 0011.
Desktop account acceptance passed. The initial browser viewport override failed; the account layout
was successfully rechecked at 375px during stage 6.1 without horizontal document overflow.

All messages use local Mailpit and test contacts. Existing access JWTs can survive logout/password reset
for their remaining lifetime (up to 15 minutes); refresh sessions are revoked. Real merchant LiqPay and
production email acceptance remain external work.

## Stage 6.1 — administrator order reads

Implemented: separate admin layout, ADMIN middleware/gateway/RPC checks, paginated order list,
search by number/contact, status/payment/guest-or-account/date filters, immutable detail snapshots and
status history. URL filters survive navigation. No guest bearer or persistence hash is returned.
The read workspace is available at /admin/orders; it does not yet mutate order status. See ADR 0012.
Browser acceptance at 375px and 1280px covers customer denial, admin login, search, detail, preserved
return filters and bounded table scrolling without horizontal document overflow.

Next: shipping/completion and inventory journal, audited mutations, paid cancellation/refunds,
product/category/promotion management, customers and dashboard. Stage 6 is not complete.

## Stage 6.2 — audited fulfillment and inventory movements

Implemented: ADMIN shipment/completion commands with reason, expected status, durable idempotency and
actor audit. Shipment consumes gram/piece reservations through OrderShipped; catalog records physical
stock/reserve deduction and SALE journal atomically, then acknowledges with StockDeducted. Completion
is blocked until acknowledgement. COD completion explicitly confirms collection; online fulfillment
requires server-confirmed payment. OrderCompleted is queued for the future consent-aware marketing
consumer. Per-order movement journal is available in the admin card through catalog RPC. See ADR 0013.
Browser acceptance at 375px/1280px covers required confirmation, mixed shipment, acknowledged
deduction, journal refresh, completion and actor audit without horizontal document overflow.

Physical returns, paid cancellation/refunds, purchase batches/manual adjustments and remaining catalog,
customer/dashboard management remain next. Stage 6 is not complete. All storefront data/dispatch and
collection actions remain demonstrations; no carrier API or real money operation is performed.

## Remaining stages

- **4a external acceptance:** Verify hosted checkout/return/refund with the owner’s LiqPay sandbox account. Offline development acceptance and storefront code are implemented; no real merchant payment has been tested.
- **6:** Administration and fulfillment/inventory journal.
- **7:** Event-based marketing and email campaigns.
- **8:** SEO, accessibility, resilience, performance and complete acceptance tests.

The MVP acceptance checklist in SPEC is not yet satisfied. No application schema or business endpoint
is represented as implemented before its milestone.

## Verification in the initial development environment

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (288 tests), `pnpm build` and `pnpm format:check` pass.
- Catalog use-case coverage: 100% statements, branches, functions and lines; real catalog integration passes.
- Auth use-case coverage: 100% lines, 98.61% statements, 92.85% branches; real PostgreSQL/RabbitMQ integration passes.
- Auth migration applies to a clean integration database; admin seed runs twice and preserves the existing password.
- `pnpm dev` starts all seven applications; `pnpm health` confirms every process.
- The Ukrainian page was checked at 375px and 1280px; the mobile document has no horizontal overflow.
- Both Compose configurations pass `docker compose config --quiet`.
- Docker access is verified after refreshing the login session. PostgreSQL, RabbitMQ, Redis and Mailpit are running and healthy.
- PostgreSQL created all five service databases; each non-superuser service role has CONNECT access only to its own service database.
- Host port 5432 was occupied, so project PostgreSQL uses `127.0.0.1:5433`; Compose, environment examples and startup documentation agree.

The optional all-container application override has been checked for configuration validity only. No production deployment is included.

## Extension — teaware and accessories

Implemented on owner request: `/teaware`, separate teaware/accessories categories, primary navigation,
homepage feature, cross-section search and four illustrative demo products (gaiwan, cup, strainer, tongs).
Equipment uses null gram weight/brewing guide, unit prices and independent integer piece inventory.
Tea keeps its existing gram-based stock. Cart, checkout, order snapshots and structured-data URLs
handle both kinds without displaying null weights or tea brewing instructions for equipment.

Mixed orders reserve all grams/pieces atomically. OrderCreated v2 carries explicit units through a
versioned routing key/queue, while the v1 consumer and legacy reservation cancellation remain active.
Integration verifies fresh migrations, repeatable seeds preserving piece reservations, equipment stock
filter parity, mixed checkout, last-piece competition without partial tea reservation, cancellation and
legacy v1 Outbox/reservation processing. Browser checks cover 375px/1280px, equipment filters, global
search, correct units, mixed confirmation and cancellation. All product data/photos remain illustrative.
