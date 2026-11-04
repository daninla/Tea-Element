# 0010 — Payment attempts, private return and storefront checkout

Status: accepted for stage 4a.3 development acceptance. Merchant LiqPay sandbox acceptance remains external.

## Retrying without duplicate orders or extending reservations

One order may have multiple immutable payment attempts. Prisma Migrate removes the payments.order_id
unique index, adds an order/time index and attempt-abandonment tombstones. Orders own attempt history
and idempotent payment-command records. Existing payment/order rows are preserved. Current payment
reads use the order's active attempt ID, not whichever event happened to arrive last. A legacy order's
existing attempt is registered lazily in order history before its first change command.

A verified PaymentFailed now marks the active order payment FAILED while keeping AWAITING_PAYMENT and
its stock reservation until the original deadline. This refines ADR 0009's immediate failure cancellation
to satisfy SPEC 8.1 retry/COD-switch behavior. The 30-minute deadline is never extended. PaymentExpired,
explicit order cancellation and stock rejection still compensate as before.

POST orders/:number/payment/retry creates another attempt only after failure; concurrent/replayed calls
with the same Idempotency-Key return the current order without creating a second attempt. Changing the
action for that key returns conflict. COD switching atomically confirms the already reserved order,
clears its active online attempt and publishes OrderConfirmed. Neither command accepts prices, contacts
or owner IDs. Both recheck private guest/owner access, deadline and order state under the order lock.

PaymentAttemptAbandoned is a new v1 event with orderId/paymentId only. Its consumer stores a per-attempt
tombstone, so it can arrive before PaymentRequested without cancelling newer attempts. Whole-order
cancellation affects every attempt. Known historical outcomes are recorded but cannot change the active
order/attempt or a COD order. Amount/currency/order membership still must match. Late money on abandoned
attempts goes through the existing durable refund workflow; a paid-before-switch race rejects the switch
or compensates the old attempt, depending on which order transaction won.

## Browser access and payment confirmation

The checkout offers demonstration COD/online choice and routes online orders to /order/[number]/pay.
The pay/result pages query orders through the typed gateway client and wait for reservation/outcome
confirmation. Only persisted PAID displays success. Query-string success/paid flags and provider-return
parameters never grant access or confirm a payment.

Guest access tokens are stored per order in same-tab sessionStorage. The hosted POST form contains
only data/signature for the fixed LiqPay endpoint; its result_url contains no guest token. On return,
/order/[number]/result restores access from that tab or owner authentication. Missing private access
shows an explicit error; no order data is fetched by email/number alone. If guest storage is blocked,
hosted navigation is stopped with a recovery message. Local simulator return can retain the private
URL bearer when browser storage fails. No token is put in a provider form or domain event.

Hosted checkout opens automatically once per attempt/tab; a manual button remains for navigation back
or a cancelled redirect. Pending/query retries and errors are bounded. Command keys survive a lost
response and are scoped to order, previous attempt and action. Forms/buttons prevent duplicate in-flight
submissions. Deadline copy uses Europe/Kyiv; provider expiry serialization stays UTC.

## Offline acceptance and remaining external work

The private POST payments/simulate endpoint accepts only number/token/outcome, with trusted owner
context as an alternative to the token. It is Origin protected and refuses LiqPay/production modes.
After payability/access checks it settles the local Fake provider and calls the same signed/audited
webhook use-case. It does not expose a signing secret or accept an amount/payment ID from the browser.
The UI explicitly labels both simulated outcomes and the absence of real charges/card input.

Real merchant credentials are not available in the workspace, so no hosted LiqPay payment was attempted.
Protocol/signature/hosted-form tests use synthetic fixtures without external traffic. Sandbox merchant
activation, provider return behavior and settlement/refund acceptance must still be checked with the
owner's sandbox account before considering LiqPay deployment-ready. Live keys remain rejected.

Unit/DOM tests cover per-order token restoration, blocked storage, command replay keys, forged success
parameters, access errors, duplicate UI actions and a hosted form that keeps the bearer local. Real
HTTP/RMQ/PostgreSQL integration adds concurrent retry, key conflict, unchanged deadlines, legacy order
attempt recovery, COD switching and late old-attempt refund races. Browser acceptance at 375/1280px
covers refusal→retry→paid, refresh without a URL token, mixed tea/piece goods, refusal→COD→cancellation,
forged success query and no horizontal document overflow. No payment-flow console error was observed.
