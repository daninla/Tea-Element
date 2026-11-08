# Orders service

## Transactional payment emails (stage 6.10)

`modules/notifications` delivers payment receipt and provider-confirmed full-refund messages to the
immutable order email, including guests without marketing consent. Validated payment-event handling
enqueues `(paymentId, kind)` once in the same transaction as state/Outbox/processed markers. Historical
attempts notify about their own funds; a known refund suppresses obsolete, unclaimed receipts.

Prisma Migrate owns the local `order_payment_notices` queue. SKIP LOCKED claims use 60-second random
leases, SMTP occurs outside transactions, and only the current lease acknowledges delivery. Three
attempts with 5/10-second failure backoff end in FAILED. Expired claims recover; no raw SMTP errors are
stored/logged. SENT means SMTP acceptance. A crash after acceptance can resend the stable Message-ID;
exactly-once mailbox delivery, bounce handling and administrative requeue are not claimed. Ukrainian
HTML/text mail contains a private tracking link and explicitly identifies this demonstration store.
Existing initial receipts are unchanged. See ADR 0021; production deliverability remains unverified.

Stage 6.9: ADMIN PATCH `/api/v1/admin/orders/:id/status` also accepts CANCELLED with expectedStatus,
reason and Idempotency-Key. Only pre-shipment orders without stock deduction qualify; paid online
orders emit OrderCancelled v2 to request reservation release and the existing full-refund saga.
Status/history/audit/Outbox are atomic under the same lock as shipment. An accepted cancellation is
not a confirmed refund. Customer cancellation permissions are unchanged. See ADR 0020.

Owns `orders_db` and its generated Prisma client. HTTP 4003 exposes health/docs only; business RPC uses
`orders.rpc`. `pnpm setup:dev` provisions an ignored private access secret; `pnpm db:migrate` deploys
its Prisma migrations. `pnpm dev` starts the service, publishers, consumers, expiry and receipt workers.

## Public API through gateway

- `POST /api/v1/cart/quote`: public, current catalog prices/discounts and aggregate gram availability.
- `POST /api/v1/orders/guest`: public, contacts/delivery/items, `Idempotency-Key` UUID; returns order/token.
- `POST /api/v1/orders`: authenticated equivalent; owner ID comes only from trusted JWT context.
- `GET /api/v1/orders/:number?token=`: valid bearer token or authenticated owner; otherwise 404.
- `POST /api/v1/orders/:number/cancel?token=`: same access; PENDING/CONFIRMED → CANCELLED.
- `GET/PUT /api/v1/cart`: authenticated read or replace (empty list clears).
- `POST /api/v1/cart/merge`: authenticated merge, UUID `Idempotency-Key`; replay never adds twice.

All writes require the configured browser Origin. Limits: 50 distinct portions, quantities 1–99,
integer kopecks and a bounded total. Input cannot contain prices, totals or owner IDs. COD was the stage 4
payment method; stage 4a.2 also accepts ONLINE_CARD through the API. Shipment pricing is not calculated; no carrier API is called.
Manual branch/courier delivery requires city/address; pickup does not. Contacts and acceptance of demo
terms are required; marketing consent is independent, false by default and stored with its timestamp.

## Persistence and access

Order snapshots contain catalog names, weights, unit/original prices, totals, contacts and delivery.
Guest `user_id` is null even if the email matches an account. Email never grants access or links history.
Guest tokens are 32-byte HMAC outputs from a private server key and a random per-order nonce. Only
SHA-256 hashes are compared with timing-safe equality; neither bearer nor PII enters broker messages.
Matching idempotency key/scope/fingerprint recovers the same order/token after a lost response. Changed
payload returns 409. Rotating ORDER_ACCESS_SECRET invalidates existing links; provision it persistently.

History is append-only. Immutable line snapshots are JSON; see ADR 0005 for this deliberate schema choice.
No cross-service database reads or service-code imports exist. Gateway is the only external API boundary.
Expired optional cookies do not block a valid guest link; protected cart routes still require valid auth.
Responses are no-store. Web pages use no-referrer/noindex and suppress dev request URLs containing tokens.

## Saga, compensation and delivery

Order + OrderCreated Outbox commit together. Catalog locks product inventory in stable order and reserves
all grams or none; stock result + reservation + processed event + catalog Outbox commit together. Orders
record StockReserved → CONFIRMED or StockReservationFailed → REJECTED atomically with history/marker.
An advisory lock serializes per-order transitions. Duplicate IDs and repeated creation for one order do
not reserve twice. Cancellation creates a RELEASED tombstone even if it arrives before creation.
Pending reservations expire in five minutes and publish OrderCancelled. Online reservations instead
enter AWAITING_PAYMENT with a 30-minute payment deadline, PaymentRequested and a unique payment attempt. Late stock success cannot revive them.
Confirmed COD orders keep reserved grams until cancellation or shipment; stage 6.2 deducts through OrderShipped.

Confirm publishers use SKIP LOCKED and exponential backoff. Durable queues reconnect, retry failures
through one-second TTL queues up to five times, then dead-letter. DLQ replay requires operational review;
no automatic destructive recovery is provided. Namespace isolation supports tests and parallel environments.

ReceiptWorker polls durable unsent orders, sends a private link through SMTP_URL (Mailpit locally), and
marks success afterwards. A crash after SMTP acceptance can resend the same Message-ID. This is a
transactional notification, never a marketing subscription. Production delivery/bounce monitoring is
future hardening; a failing oldest receipt currently waits for SMTP recovery before later receipts.

## Verification

`pnpm --filter @tea/orders-service test` covers creation/replay, transition rules, cart policy, validation,
token checks and operational health. After `pnpm build`, `pnpm test:orders:integration` creates two fresh
temporary databases, deploys migrations, seeds twice and exercises gateway/RMQ/database/SMTP on ports
4300/4302/4303. It tests rollback, no oversell, duplicates, access, cancellation/expiry and DLQ, then removes
its own databases/topology. Existing application data is not reset. `pnpm test:integration` includes it.

Account UI, email lookup/verified linking, shipping administration, online payment UI and marketing are
separate milestones. No endpoint or transition for those features is presented as implemented here.

## Mixed tea/equipment orders

Quotes/snapshots use null weight for piece goods and numeric weights for tea. All new orders publish
OrderCreated v2 with explicit stockUnit/stockQuantity through the new versioned routing key. No orders
schema migration is needed because existing item snapshots are immutable JSON; historical orders still
render correctly. Creation idempotency and guest/owner access are unchanged. Integration also covers
mixed reservations, competition for the last equipment piece and v1 compatibility; see ADR 0006.

## Online payment backend (stage 4a.2)

StockReserved changes an online order to AWAITING_PAYMENT and records PaymentRequested atomically.
PaymentSucceeded must match the stored attempt/total/UAH; it changes a waiting order to PAID and emits
OrderPaid. Failure/expiry cancels and publishes existing OrderCancelled compensation. Independent
order expiry also progresses while payments are unavailable. Guest/owner cancellation is allowed while
awaiting payment; paid cancellation remains future administration. Late success cannot revive a cancelled
order, and refund-before-success cannot overwrite REFUNDED with PAID. PaymentRefunded compensates any
unfulfilled active order. No guest token or contact data is included in payment events.

## Retry and COD switch (stage 4a.3)

POST /orders/:number/payment/retry or /cod with private access and UUID Idempotency-Key executes under
the existing order lock. Failure now marks payment FAILED while keeping AWAITING_PAYMENT until the
original deadline. Retry creates one new attempt/history entry per command; COD confirms the existing
reservation. The deadline never extends. PaymentAttemptAbandoned compensates a pending old attempt
without cancelling the order. Known historical outcomes cannot overwrite the active attempt/COD state.
Legacy active attempts gain history before the first command. PaymentExpired still cancels/releases.
OrderView now includes active attempt ID, payment status and optional payment deadline. No amount,
redirect URL, identity or contact change is accepted by these commands. See ADR 0010.

## Verified account history (stage 5)

UserEmailVerified links only unowned matching-email orders created before the proof. A local identity
projection and periodic reconciliation cover delayed commits without cross-service database access.
Processed events and ownership updates commit together. Later guest orders require a fresh proof.
GET /orders accepts a trusted owner ID and bounded page number; private tokens never appear in history.
POST /orders/lookup always acknowledges neutrally and rate-limits requeued private receipts. See ADR 0011.

## Administrator reads (stage 6.1)

`modules/administration` implements admin.orders.list/detail RPC. A strict trusted ADMIN context is
required. List pages have 20 rows with deterministic createdAt/id order and repeatable-read count; filters
cover literal number/contacts, status, payment, account/guest and UTC dates. Detail includes immutable
contacts/delivery/items/history and comment. No bearer/hash/nonce is returned. No database change is
required. Status mutations and stock deduction are described below in stage 6.2; see ADR 0012 for reads.

## Fulfillment (stage 6.2)

ADMIN transition RPC accepts SHIPPED/COMPLETED, expectedStatus, UUID key and reason. Audit/status/history/
Outbox commit under the existing order lock. COD confirmed or paid online orders can ship; completion
waits for StockDeducted and confirms COD collection. Replays are idempotent, stale/conflicting commands
return 409. Admin detail includes actor audit and stockDeductedAt. Paid cancellation/physical returns
remain future work. OrderCompleted snapshots queue for stage 7. See ADR 0013.

## Operational dashboard (stage 6.6)

ADMIN RPC `admin.orders.dashboard` accepts `{days:1|7|30}` with trusted context. It reports Kyiv calendar
creation counts and current unlinked accounts, plus currently fulfilled/paid revenue recognized by first
COMPLETED history time. Online and COD are separate; top snapshot product quantities retain gram/piece
units. Repeatable Read, safe integer conversion and server asOf bound the report. No payment ledger or
sibling database is read. See ADR 0017 for precise metric and settlement limits.

## Customer history (stage 6.7)

ADMIN RPC `admin.customers.orders` provides GUESTS pages or HISTORY with a strict account-ID/guest-email
selector. Gateway GET `/api/v1/admin/customers/guests` accepts page/q; GET `/api/v1/admin/customers/history`
accepts kind=ACCOUNT&id=UUID or kind=GUEST&email=EMAIL, plus page. Account history uses only user_id;
guest groups use only null user_id and canonical contact email. No email-based ownership expansion occurs.
Counts/contacts/order pages/completed-paid product summaries share Repeatable Read. Guest contacts are
unverified grouping keys, not authentication or campaign permissions. See ADR 0018.
