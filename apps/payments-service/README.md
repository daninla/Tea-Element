# payments-service

HTTP liveness: `http://localhost:4004/health`; Swagger: `http://localhost:4004/docs`.
From the repository root: `pnpm --filter @tea/payments-service dev`. Copy `.env.example` to `.env`
for local overrides. Liveness does not query providers, databases or brokers.

## Stage 4a.1 — provider adapters

`modules/payments/domain/payment-provider.ts` defines the private PaymentProvider port:
createCheckout, verifyWebhook, parseWebhook, getStatus and full refund. PaymentProvidersModule
registers its selected implementation and exports the port for the next payment workflow increment.
Domain code has no NestJS or Prisma dependency. The stage 4a.2 ledger and gateway/RMQ routes extend these adapters as described below.
The storefront payment controls remain stage 4a.3; its checkout still offers demonstration COD.

- FakePaymentProvider is the development default. It simulates pending/success/failure, signed callbacks,
  lost callbacks and full refunds offline. State/signing secrets are process-local; restart clears them.
  The settle hook is a test harness method, with no public simulation endpoint.
- LiqPayProvider creates hosted POST checkout data and signs API v7 requests using SHA3-256. It verifies
  signatures timing-safely and checks merchant/attempt ID, exact integer kopecks and UAH. Only known
  statuses are normalized; arbitrary provider/card/contact fields are stripped from observations.
  Status/full-refund requests have bounded responses, a deadline, no redirects and no automatic retries.
  A refund awaiting provider funds stays pending. Partial-refund observations retain the refunded
  amount and prevent a second full-amount refund. Full-refund calls require future durable serialization;
  this adapter alone does not guarantee idempotent concurrent commands.

## Configuration

`PAYMENT_PROVIDER=fake` needs no credentials; production rejects this mode. To construct the LiqPay
sandbox adapter, set `PAYMENT_PROVIDER=liqpay`, `LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`,
`PAYMENT_CALLBACK_URL` and `CORS_ORIGIN` in the private service `.env` or process environment.
Both keys must start with sandbox_; live keys are intentionally rejected in this demonstration stage.
LiqPay callback and storefront origins must use HTTPS. Return URLs must match that storefront origin.
The callback address must point to the gateway `/api/v1/payments/webhook/liqpay` route.
Only the active provider accepts callbacks; Fake uses `/api/v1/payments/webhook/fake`.

The implementation follows the current official API v7 tables, not the legacy v3 SDK samples on the
same documentation pages. See [ADR 0008](../../docs/adr/0008-payment-provider-boundary.md) for references
and the remaining delivery boundary. No actual merchant credentials or card data belong in the repo.

## Verification

`pnpm --filter @tea/payments-service test` covers the adapter boundary and operational HTTP/configuration.
No test contacts LiqPay. After `pnpm build`, run `pnpm demo:payments` for a compiled offline adapter demo:
pending → signed success → duplicate/tampering checks → lost-callback status read → replayed full refund.
This exercises provider behavior, not a persisted order/payment saga.

## Stage 4a.2 — durable backend

Owns an isolated Prisma payments_db: payment ledger, raw callback audit, full-refund jobs, cancellation
tombstones, Outbox and processed markers. `pnpm db:migrate` includes payments; schema changes use
Prisma Migrate. payments.rpc receives business requests; local HTTP remains health/docs only.

Gateway API (no card/contact data accepted):

- `POST /api/v1/payments/checkout` with number/token, or authenticated owner cookie: returns a stored
  payment and provider checkout descriptor only for a reserved, unexpired online order.
- `GET /api/v1/payments/status?number=&token=`: the same private order access, persisted payment state.
- `POST /api/v1/payments/webhook/:provider` with data/signature: bounded raw audit before rejection,
  selected-provider verification, amount/currency/attempt checks, atomic state/Outbox and semantic replay
  protection. Only this callback handler bypasses browser Origin checks.

PaymentRequested follows stock reservation and creates one attempt per order. OrderCancelled leaves a
durable tombstone and schedules a full refund if needed. Maintenance reconciles every 30 seconds,
expires unpaid entries after their 30-minute deadline and claims refunds before external calls.
Expired/failed attempts still reconcile for late money. Orders independently enforce their deadline.
A late success never revives a cancelled order. Raw callbacks never enter events, logs or API responses.

Refund statuses REQUESTED/IN_FLIGHT/WAITING/COMPLETED/REVIEW_REQUIRED distinguish safe retries from
uncertain external outcomes. An ambiguous request or stale claim requires review and status reconciliation;
it is not submitted again automatically. Full/partial refund observations never regress to paid. There
is no administrative review UI yet. Fake provider memory is still local to its process; payment ledger,
audit and jobs persist, but a missing simulated provider record after restart can require refund review.
Optionally set a private FAKE_PAYMENT_SECRET (32+ characters) for a development callback harness.

After building, `pnpm test:payments:integration` exercises real gateway/RMQ/PostgreSQL with three
fresh temporary databases, clean migration deployment and isolated queues. It tests guest/owner access,
audit of invalid callbacks, concurrency, Outbox rollback, expiry/release, late-success refund, reordering,
lost callback reconciliation, tombstones and refund claim quarantine; cleanup removes its own fixtures.
The root integration command includes this suite. No test contacts LiqPay.

Stage 4a.3 implements the storefront and multiple attempts; only merchant sandbox acceptance remains external. Live payment acceptance is not claimed. See [ADR 0009](../../docs/adr/0009-durable-payment-saga.md).

## Multiple attempts and offline UI

Registration is idempotent per payment attempt UUID; orderId is indexed rather than unique. Abandonment
has a per-attempt tombstone, independent of whole-order cancellation. Checkout/status resolve the active
attempt from the private order response. Failed attempts remain auditable and are reconciled/refunded
if they later receive money; they cannot confirm a new attempt. Stock remains reserved only until the
original order deadline. See ADR 0010, which refines the first backend increment's failure behavior.

POST /api/v1/payments/simulate is a private, Origin-protected Fake-only development endpoint. Number/token
or trusted ownership is required; only SUCCEEDED/FAILED outcome is accepted. It reuses payability checks,
provider signing and raw webhook audit. No signing key reaches the browser. LiqPay and production refuse
simulation. Fake provider memory remains process-local; ledger/audit/jobs persist.

## Payment administration (stage 6.8)

ADMIN GET `/api/v1/admin/payments` accepts page/q/status/provider/from/to/refundOnly; GET `/:id` returns
safe ledger/refund state, GET `/events` returns bounded callback metadata, and GET `/:id/commands` returns
actor/reason/attempt audit. No raw payload, hosted fields or signatures leave this boundary.
POST `/:id/reconcile` accepts expectedStatus/reason plus Idempotency-Key and returns 202 with a historical
QUEUED receipt. Scheduling and audit commit atomically. The worker captures visible command IDs and
acknowledges only those after attempting status retrieval; newer requests remain due despite overlapping
automatic defer. Provider failure remains a failed attempt, not payment success. See ADR 0019.
Manual paid cancellation/refund/return controls and merchant live acceptance remain unfinished.
