---
name: payments-webhook
description: Use when working on payments-service, the PaymentProvider interface, LiqPay integration, payment webhooks, refunds, payment expiry or reconciliation.
---

# Payments and webhooks

Read SPEC.md sections 4.3 (payments-service), 6.5 and 9 first.

## Rules
1. Only `payments-service` talks to a payment provider, through the `PaymentProvider` interface (`createCheckout`, `verifyWebhook`, `parseWebhook`, `getStatus`, `refund`). Implementations: `LiqPayProvider`, `FakePaymentProvider`.
2. Card data never touches our servers (hosted checkout only). Never log keys, secrets or payloads containing personal data.
3. **Webhook handler order:** (a) save raw payload to `payment_events` with `signature_valid`, (b) verify signature with timing-safe comparison, reject with 4xx if invalid, (c) verify paid amount and currency equal the stored payment amount, (d) apply status transition idempotently, (e) write outbox event (`PaymentSucceeded` / `PaymentFailed`) in the same transaction.
4. Status transitions are a state machine; ignore impossible or repeated transitions silently (return 200 so the provider stops retrying).
5. Reconciliation cron: for payments stuck in `PENDING`, call `getStatus()` and apply the same transition logic.
6. Expiry: unpaid payments expire after 30 minutes -> `PaymentExpired`.
7. Refunds: on `OrderCancelled` for a paid order, or from the admin endpoint -> `refund()` -> `PaymentRefunded`.
8. Secrets only from env (`LIQPAY_PUBLIC_KEY`, `LIQPAY_PRIVATE_KEY`). In dev default to `PAYMENT_PROVIDER=fake`.

## Tests required
Invalid signature rejected; duplicate webhook is a no-op; wrong amount rejected; lost webhook fixed by reconciliation; expiry cancels the order and releases stock.
