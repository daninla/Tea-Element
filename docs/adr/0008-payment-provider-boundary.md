# 0008 — Sandbox payment provider boundary

Status: accepted for stage 4a.1 (provider adapters only).

Stage 4 remains the operational storefront: all orders use demonstration COD. Implement the provider
boundary before adding a durable payment ledger and extending the reservation saga. This increment
registers a PaymentProvider port with FakePaymentProvider/LiqPayProvider implementations inside
payments-service; it adds no public payment/webhook route or business event. No application imports a
sibling service. Provider-specific types are private to this service until external DTOs are needed.

## Protocol and trust boundary

Use the current LiqPay API v7 parameter tables and SHA3-256 signing instructions, checked on 2026-11-04.
Some SDK snippets on the same official pages still use v3/SHA1. Do not fall back to SHA1 or accept both
algorithms. Sandbox operation uses sandbox_ credentials, not an assumed legacy sandbox request flag.
This milestone rejects live credentials and refuses the Fake provider in production. Real deployment
and acceptance against an owner's LiqPay sandbox account remain separate work.

The adapter creates a POST checkout form for the fixed LiqPay HTTPS endpoint. Only the merchant public
key and signed checkout data leave the service; there is no private key in that form. Return URLs must
use the configured HTTPS storefront origin, callbacks HTTPS, and expiry is serialized in UTC. Merchant
order_id is a unique payment attempt ID, not an order number reused across retries. This boundary
accepts server-generated amounts only; the forthcoming order-access use-case must supply that intent.

Webhook parsing always verifies the signature first with timing-safe comparison, even if the caller
has already called verifyWebhook. Canonical base64, bounded envelopes, decimal precision, merchant,
attempt ID, amount and UAH currency are checked. Unknown statuses fail closed. Normalized observations
exclude card tokens, phone numbers and arbitrary provider fields. All amounts within the application
are integer kopecks; provider decimal strings are converted without floating-point multiplication or
rounding a malformed amount into a valid one.

Status and full-refund calls use a fixed HTTPS endpoint, five-second deadline, bounded streamed
responses, no redirects and no automatic retries. Errors contain only stable internal codes. Full
refunds first inspect provider status; an already refunded or pending refund does not trigger another
refund request. wait_amount=true remains pending, including on callbacks and status reads. This is not
a substitute for a durable refund command/idempotency workflow: concurrent commands and uncertain
network outcomes must be serialized/reconciled by the later ledger. Partial-refund observations preserve integer refund_amount and prevent another full-amount refund;
partial-refund commands are not exposed.

FakePaymentProvider is an offline in-memory provider simulator with a random process-local signing
secret. Its test-only settle hook allows success/failure and intentionally lost callbacks. It is not
the application payment database; restart loses simulated provider state. It has no public route.

## Delivery boundary and verification

Adapter tests cover signed/tampered callbacks, mismatched identities/amounts/currencies, duplicate
parsing, provider status after a lost callback, full refund replay, delayed refunds, malformed/oversized
responses and safe transport errors. The offline demo runs against the compiled adapter and never
uses card details, the network or application databases. No dependency is added.

Still required for stage 4a completion: Prisma payments/payment_events/refunds/Outbox/processed-event
storage, audit before rejection, atomic idempotent state transitions, PaymentRequested and payment
outcome contracts, saga compensation (including late success after cancellation), expiry,
reconciliation/refund workers, guest/owner authorization at gateway, retry/COD-switch behavior,
storefront UI and real HTTP/RMQ/PostgreSQL integration. Adapter tests do not claim those guarantees.

Sources: [checkout](https://www.liqpay.ua/doc/api/internet_acquiring/checkout),
[callbacks](https://www.liqpay.ua/uk/doc/api/callback),
[status](https://www.liqpay.ua/doc/api/information/status_payment),
[refund](https://www.liqpay.ua/doc/api/internet_acquiring/refund),
[testing](https://www.liqpay.ua/uk/doc/api/testing).
