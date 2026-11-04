# payments-service

HTTP liveness: `http://localhost:4004/health`; Swagger: `http://localhost:4004/docs`.
From the repository root: `pnpm --filter @tea/payments-service dev`. Copy `.env.example` to `.env`
for local overrides. Liveness does not query providers, databases or brokers.

## Stage 4a.1 — provider adapters

`modules/payments/domain/payment-provider.ts` defines the private PaymentProvider port:
createCheckout, verifyWebhook, parseWebhook, getStatus and full refund. PaymentProvidersModule
registers its selected implementation and exports the port for the next payment workflow increment.
Domain code has no NestJS or Prisma dependency. No payment schema or HTTP/RMQ payment route exists yet;
the storefront still uses demonstration COD.

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
The callback address describes the future gateway endpoint; configuring it does not create that route.
Do not send traffic there until the durable webhook workflow is implemented.

The implementation follows the current official API v7 tables, not the legacy v3 SDK samples on the
same documentation pages. See [ADR 0008](../../docs/adr/0008-payment-provider-boundary.md) for references
and the remaining delivery boundary. No actual merchant credentials or card data belong in the repo.

## Verification

`pnpm --filter @tea/payments-service test` covers the adapter boundary and operational HTTP/configuration.
No test contacts LiqPay. After `pnpm build`, run `pnpm demo:payments` for a compiled offline adapter demo:
pending → signed success → duplicate/tampering checks → lost-callback status read → replayed full refund.
This exercises provider behavior, not a persisted order/payment saga.

The remainder of stage 4a adds the payment ledger, raw callback audit, Outbox/idempotent consumers,
authorized guest/owner APIs, expiry/reconciliation/refund workers, checkout UI and integration tests.
No such behavior is represented as implemented by these adapters.
