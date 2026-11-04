# 0009 — Durable payment ledger and cancellation compensation

Status: accepted for stage 4a.2 (backend API/saga; storefront payment controls remain stage 4a.3).

## Ownership and transactions

payments-service owns payments_db, its generated Prisma client and Prisma Migrate history. It stores
payments, raw payment_events, full-refund jobs, cancelled-order tombstones, Outbox and processed_events.
Dependencies are the same pinned Prisma/RabbitMQ/Nest transport libraries already used by orders and
catalog; they support database isolation and confirmed messaging, not another provider SDK.

A successful online stock reservation atomically changes the order to AWAITING_PAYMENT, allocates a
payment attempt UUID, sets a 30-minute deadline and records PaymentRequested. COD behavior and
OrderCreated v1/v2 compatibility are preserved. Payment registration/cancellation consumers serialize
by order ID and commit processed markers in their own database transactions. Cancel-before-create is
remembered independently of the payment row. This increment supports one payment attempt per order;
retry/switch-to-COD commands and their multi-attempt policy belong to the next storefront increment.

Verified observations and payment outcome Outbox writes commit together. Status-based semantic
idempotency prevents duplicate outcomes even for callback replay with no provider event ID. Raw
callback audit commits separately before applying or rejecting the observation, so a forged signature,
amount mismatch or failed Outbox transaction cannot erase evidence. The supported bounded data/signature
envelope is retained verbatim in JSON; malformed HTTP envelopes rejected by DTO validation do not reach
this audit. Raw data is never exposed by the API or logged. The service database and read-only operational
role therefore require restricted access, as with existing private order snapshots.

## Access and transport

Only gateway exposes business HTTP. Payments verify access via orders RPC on every checkout/status
request; a number/email alone is never sufficient. JWT ownership comes from gateway context, never the
body. Checkout accepts only number/token, not an amount or redirect URL. Current order state must be
AWAITING_PAYMENT/ONLINE_CARD; cancellation, deadline or terminal payment state blocks checkout.

The gateway's Origin exception is explicit method metadata on the provider callback handler only.
Callbacks remain public but authenticate by the selected provider's signature. All browser writes
retain the existing Origin requirement. The selected provider must match the payment's stored provider.
The status response exposes no raw payload, contacts, access token or provider credentials.

The future browser flow must retain its private order token across hosted checkout and restore it on
return. The generated return URL intentionally excludes the guest token. No working redirect/result UI,
retry/COD-switch control or real merchant sandbox acceptance is claimed in this increment.

## Deadlines, late money and refunds

Maintenance reconciles before expiring a payment and reuses the callback transition transaction.
Provider outages do not fabricate success. The independent order deadline ensures stock compensation
also progresses if payment processing is unavailable. A race between payment and deadline can cancel
an order; real money arriving later is recorded and refunded, never used to revive that order.
Succeeded, failed and expired ledger entries continue periodic status checks for late provider changes.
Full/partial refund observations cannot regress to success; orders also tolerate refund-before-success.

Cancellation durably upserts one full-refund job when money was received. A worker atomically claims
REQUESTED → IN_FLIGHT before making an external call. Completed results update ledger/refund/Outbox
atomically. Pending results wait for reconciliation. A crash or uncertain transport result becomes
REVIEW_REQUIRED (stale claims after one minute); it is never blindly resubmitted. Automatic exactly-once
external refunds cannot be promised without provider idempotency. Later administration must expose
these operational cases. Partial refunds are observed but no partial-refund command is exposed.

Fake callbacks also supply simulator-side status, without regressing terminal observations. Its provider
memory remains process-local; the application ledger/audit/jobs survive restart. A lost Fake provider
state after restart can require review for a refund, rather than inventing a successful provider operation.
LiqPay continues to reject live keys; no real funds are accepted. No test contacts LiqPay.

## Verification

Unit tests exercise verification/audit order, amount checks, access before ledger reads, lost-callback
reconciliation, provider outages and refund ambiguity. The new integration suite creates three temporary
service-owned databases and isolated broker topology; it checks fresh migrations/repeatable catalog seed,
real gateway/RPC/private access, forged and mismatched raw callbacks, concurrent duplicate deliveries,
atomic Outbox rollback, paid history/event uniqueness, deadlines/stock release, late success/refund,
refund reordering, cancellation tombstones and durable refund claims. Existing auth/catalog/orders
integration remains required. No application database schema is edited outside Prisma Migrate.
