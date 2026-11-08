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

## Stage 6.3 — purchase batches and stock adjustments

Implemented: ADMIN inventory list/search/section/low-stock filters, per-product physical/reserved/available
balances, purchase batches and manual adjustments/write-offs. Stock, cost/supplier/date records, movement
and actor/command audit commit atomically. UUID keys provide stable replay results; stale physical balance
and reserved-stock violations return conflicts. Product-scoped batch/movement history has bounded pages.
Browser attempt metadata preserves safe uncertain retries and requires history review before a changed
operation. See ADR 0014.

Real integration covers rollback, competing commands, reservation races, gram/piece units, literal search
and history pagination. Browser checks at 375/1280px cover a demo purchase, protected reservation, valid
write-off and supplier/cost history with no document overflow. Physical stock was restored after the demo
receipt/write-off pair; the real-operation setup and final documentation remain unfinished.

Remaining stage 6 scope includes dashboard/customers, paid returns
and refunds, configurable low-stock alerts and their email delivery. Stage 6 is not complete.

## Stage 6.4 — catalog editing and product photographs

Implemented: ADMIN product/category lists and forms, search/section/visibility filters, bounded pagination,
product descriptions, base prices, new tea portions, brewing guides, tags, image ordering and deactivation.
Category choices support further pages. Existing variant IDs/SKU/weights, stock units and URLs are immutable;
new products start with empty inventory. Revision checks prevent lost edits. Idempotent command snapshots
and before/result audit commit atomically. Public catalog/quotes read current prices and availability.

Actual JPEG/PNG/WebP uploads are bounded, decoded and normalized by Sharp, with opaque WebP media URLs.
Catalog owns persisted files/metadata; web serves media through gateway, with no shared filesystem needed.
Persistent volume plus database/file backups are required for deployment. Unused uploads and crash orphans
are retained; automatic cleanup/CDN is not implemented. See ADR 0015.

Real integration verifies trusted ADMIN access, concurrent edits, replay conflicts, audit rollback, portion
compatibility, public prices/stock/category hiding, piece products, image bytes/SVG rejection/upload limits.
Browser acceptance at 375/1280px covers category/product creation, changed prices and added portions on
the storefront, image selection/upload, hidden records and filter reset after returning from a product.
A regression test keeps unsaved admin forms mounted during background session refresh (including file
chooser return). Browser demonstration product/category remain explicitly labeled and deactivated.
Stage 6 still needs dashboard/customers, paid returns/refunds and low-stock notification setup.

## Stage 6.5 — promotion administration

Implemented: ADMIN paginated promotion list/search/enabled filters, creation and revision-protected editing,
percent/fixed discounts, explicit timezone-aware period fields, paginated product/category target selection,
deactivation, idempotent saves and transactional actor audit. Public catalog and fresh server quotes reuse
existing best-single-discount pricing, with half-open periods and nonnegative integer kopecks. Past order
snapshots are unchanged. No new dependency/cache is introduced; see ADR 0016.

Integration verifies public prices/quotes, overlapping targets, future/expired/disabled promotions, invalid
percentages/targets, role checks, stable replay, conflicting revisions and audit rollback. PromotionStarted
publication and consent-aware campaign delivery remain stage 7. Browser checks at 375/1280px verify
creation, fixed/percent edits, live public prices (220 → 165 → 207.66 → 220 UAH), deactivation and no
horizontal document overflow. The clearly labeled demonstration promotion remains disabled.
Remaining stage 6 scope includes dashboard,
customers, paid returns/refunds, payment administration and configurable low-stock notifications.

## Stage 6.6 — operational admin layout and dashboard

Implemented: compact sans-serif admin typography, clear cell/input borders, bounded keyboard-scrollable
tables with headers, and tabular order lines, histories, actor audit, warehouse movements/purchases and
promotion targets. Catalog/stock forms retain bordered editable groups. Storefront layout is unchanged.

`/admin` is now the operational overview. An ADMIN-only orders report provides 1/7/30 Kyiv calendar days,
created/currently unlinked counts, fulfilled-paid revenue split online/COD, average check, zero-filled daily
series and top snapshot product revenue with distinct gram/piece quantities. Independent current low-stock
and recent-order widgets use existing gateway APIs. Metric definitions and snapshot/settlement limits are
visible in the UI. No cache, dependency or schema change is introduced; see ADR 0017.

Integration covers DST boundaries, recognition by first completion rather than creation, refund/unfinished/
future exclusions, duplicate history, current guest linking semantics and empty reports. Browser checks at
375/1280px cover all five list sections, order/stock detail, product editing and dashboard period changes.
Table regions contain overflow, navigation remains available on desktop, and no browser console errors
were observed. Remaining stage 6
scope includes customers, paid returns/refunds, payment administration and configurable low-stock alerts.

## Stage 6.7 — customer accounts and guest contact history

Implemented: ADMIN account/guest lists with search, stable bounded pagination and strict table layouts;
account metadata comes from auth, guest contact groups and purchase history from orders. Account history
uses exact user_id; guest history uses null user_id plus normalized email. Matching emails never merge
identity or bypass verified linking. Inactive/no-order CUSTOMER accounts remain visible; staff accounts
are excluded. Latest guest contacts, completed-paid totals and actual purchased-product snapshots are
shown with explicit unit and identity limits. No messages, consent/ownership edits or new events exist.

Real integration covers active-ADMIN recheck, secret-field exclusion, current guest grouping, literal
search/pagination, completed/refunded statistics and disjoint account/guest scopes. No schema change or
new dependency is required. Preference inference and consent-aware marketing remain stage 7. Remaining
stage 6 scope includes paid returns/refunds, payment administration and configurable low-stock alerts.
Browser checks at 375/1280px verify account/guest lists, no-order account and purchased guest cards,
filtered return from order detail, preserved search/reset, contained horizontal scrolling and no console
errors. See ADR 0018.

## Stage 6.8 — payment journal and reconciliation requests

Implemented: ADMIN payment list/search/status/provider/date/refund filters, payment cards, refund-job
state, paginated safe provider-event metadata including invalid/unattributed callbacks, and an audited
manual reconciliation request. Payment data is read from payments_db only; raw callback/checkout secrets
are not exposed. Requests require expected status, reason, confirmation and a stable command key.

A persisted wake-up queue prevents automatic scheduling from losing a new manual request. Maintenance
acknowledges only request IDs captured before its provider check. Attempt timestamps do not imply provider
success; existing observation/Outbox/expiry/refund-quarantine policies remain authoritative. See ADR 0019.
No manual paid-order cancellation/refund retry, partial-refund or physical-return UI is implemented here.
At this milestone, coordinated paid cancellations/returns remained open. Configurable low-stock thresholds and email alerts were subsequently removed from scope by the owner on 2026-11-08.
Marketing, production deployment/provider/email acceptance, hardening and final documentation remain open.

Verification: the real payment integration suite covers literal/date/refund filters before pagination,
strict ADMIN authorization, metadata-only events, replay/conflicts, captured-command acknowledgement,
an overlapping reconciliation request and audit rollback. Browser QA covers search → card → filtered
return → reset (all three demo attempts return), required confirmation, an accepted FAKE reconciliation
with its eventual attempt timestamp, and the global invalid-signature empty state. At 375px the document
fits the viewport and wide audit tables scroll inside their containers. No real money was moved.

## Remaining stages

Stage 7.2 completes the owner's simplified newsletter scope: two rules only, generic DISCOUNT notices
and fixed 30-day WIN_BACK reminders. No personalized recommendations, consumption model, welcome
series, new-product announcements, template editor or manual campaign sending is required. Two ADMIN
switches and a strict paginated/filterable journal are available at `/admin/campaigns`. Settings,
queue cancellation and actor-bound idempotency/audit receipts commit together; revision checks reject
stale edits. Both rules default disabled. See ADRs 0023/0024.

Marketing retains only consented purchase projections and uses a catalog RPC snapshot of public
promotion metadata; no sibling database access or new broker events. Active date/revision checks,
one pending job per profile and a shared weekly slot prevent competing rules from multiplying mail.
Opt-out clears derived history/name; disabling cancels pending mail and serializes with final SMTP.
Cancelled cycles are not automatically resent on re-enable. Timestamped consent prevents stale opt-in.
Automatic approval review's earlier tooling SELECT grants for marketing PII remain unapplied;
application functionality uses the owner role and is unaffected.

Verification: 372 unit tests, root lint/build/type/format and all five integration suites pass.
Real PostgreSQL/RMQ/HTTP/Mailpit checks cover consent/legacy boundaries, fixed 30-day eligibility,
active-only generic discount capture in HTML/text, global weekly limits, retries, command replay,
revision conflicts, audit rollback, safe literal-filtered logs, cancellation on disable, unsubscribe
races and stopped-service catch-up. Production sender/domain, real SMTP credentials and deliverability
acceptance remain separate; automated campaigns stay disabled in development after verification.
Browser QA at 375px/1280px verifies both on/off controls, persisted disabled state after reload,
empty search/reset, a captured delivery journal row and no horizontal document overflow. The journal
scrolls independently on mobile; no browser errors or warnings were observed.

Stage 6.11 adds transactional shipment/completion emails, using the existing durable queue and
immutable order email for guests/accounts without marketing consent. Status, history, administrator
audit, Outbox and notification enqueueing commit atomically. Unique per-order/status keys preserve
per-attempt payment deduplication; completion cannot overtake a pending shipment notice. No carrier
tracking, historical backfill or production deliverability is claimed. See ADR 0022. Initiating partial
refunds was removed from scope by the owner on 2026-11-08; stock threshold emails remain excluded.

Verification: 355 unit tests and all root lint/build/type/format checks pass; all four real integration
suites pass. Guest COD and online shipment/completion reach Mailpit once per status; queue failure
rolls back the transition. Deterministic queue checks cover completion blocked by a delayed retry or
active shipment lease, then becoming eligible after acknowledgement. Browser previews verify real
captured HTML on desktop/phone with wrapped references and no invented payment-attempt details.

Stage 6.10 implements transactional online-payment receipt and confirmed full-refund emails to the
order email, independent of marketing consent. A local transactional queue, semantic deduplication,
bounded retries, crash-recoverable leases and private HTML/text templates are implemented; SMTP
acceptance does not guarantee exactly-once mailbox delivery. See ADR 0021. No historical backfill,
campaigns, failed-mail administration or production deliverability acceptance is claimed.

Verification: 353 unit tests, root lint/build/typecheck/format and all four integration suites pass.
Mailpit captures both new message kinds without marketing consent; the payments suite also checks
rollback, semantic replay, concurrent claims, retry exhaustion, expired leases and stale acknowledgements.
Browser QA verifies desktop and narrow phone previews; long order/attempt references wrap correctly.
All deliveries in this acceptance run are local demonstration messages, not production email.

Stage 6.9 implements ADMIN cancellation before shipment, including full online-payment refund intent,
gram/piece reservation release, command replay and audit. OrderCancelled v2 preserves the v1 protocol;
existing background jobs confirm refunds or quarantine unknown results. See ADR 0020. Physical returns
after shipment and review resolution remain open. Initiating partial refunds was removed from scope by the owner on 2026-11-08. Configurable low-stock thresholds
and email alerts were removed from scope by the owner on 2026-11-08.

Verification: all four integration suites pass, including mixed gram/piece cancellation, one full
refund, audit/Outbox rollback, command replay, delayed success and shipment/cancellation races. Browser
QA verifies required confirmation, cancellation audit, pending then confirmed Fake refund, reservation
release and the order-filtered payment journal. At 375px the form fits without document overflow.
No merchant payment or real refund was performed.

- **4a external acceptance:** Verify hosted checkout/return/refund with the owner’s LiqPay sandbox account. Offline development acceptance and storefront code are implemented; no real merchant payment has been tested.
- **6:** Further returns/refund-management work was removed from scope by the owner on 2026-11-08. Existing late/erroneous-payment compensation remains. Configurable stock threshold emails are also excluded.
- **7:** Event-based marketing and email campaigns.
- **8:** SEO, accessibility, resilience, performance and complete acceptance tests.

The MVP acceptance checklist in SPEC is not yet satisfied. No application schema or business endpoint
is represented as implemented before its milestone.

## Verification in the initial development environment

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (366 tests), `pnpm build` and `pnpm format:check` pass.
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

## Final documentation requested by the owner

Before real-operation handoff, and on the owner's request after implementation is complete, prepare
the Russian architecture/code-reading/interview guide described in
[final documentation requirements](final-documentation-requirements.md). It must include actual
system-design patterns, per-service ER diagrams, technology tradeoffs, real caching behavior and
a beginner-friendly explanation of the payment lifecycle and money flow. Do not treat planned
patterns or unverified production capabilities as implemented.
