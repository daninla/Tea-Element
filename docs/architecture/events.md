# Event catalog

| Event / version    | Producer              | Consumer queue                                                | Payload                                              | Trigger                                  |
| ------------------ | --------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| UserRegistered / 1 | auth-service Register | marketing.user_registered (durable, consumer planned stage 7) | userId, email, firstName, lastName, marketingConsent | Customer and first session are committed |

Contract: `packages/contracts/src/auth.ts`. Envelope: eventId (UUID), name, version, occurredAt (ISO),
correlationId, payload. No password, JWT or guest token is published. Payload contains customer contact
information; keep broker access private and do not log message bodies.

Routing key `auth.user_registered`, topic exchange `tea.events`. Publisher provisioning binds the durable
queue before sending; persistent messages require publisher confirms. Unconfirmed events remain in
`auth_db.outbox` with persisted exponential backoff capped at five minutes. SKIP LOCKED allows multiple
publishers. The update of user, first session and outbox is atomic. A crash after confirmation but before
outbox commit may duplicate delivery: future consumers must record processed_events.event_id inside
their side-effect transaction. The registration consumer is still planned for stage 7.

DLX `tea.events.dlx`, queue `marketing.user_registered.dlq`; consumer retry/nack policy will be implemented
with the marketing consumer. No saga or compensation is required for registration in this milestone.
The admin seed is operational provisioning, not a customer-registration event.

## Checkout events (version 1)

Contract: `packages/contracts/src/orders.ts`; same UUID/time/correlation envelope. Checkout payloads
contain inventory/order IDs only, never contacts, tokens or card data.

| Event                  | Producer | Consumer queue                  | Payload                                                       | Trigger                                             |
| ---------------------- | -------- | ------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| OrderCreated           | orders   | catalog.order_created           | orderId, items[{productId, variantId, weightGrams, quantity}] | Order/snapshots/Outbox commit                       |
| StockReserved          | catalog  | orders.stock_reserved           | orderId                                                       | Entire gram reservation commits                     |
| StockReservationFailed | catalog  | orders.stock_reservation_failed | orderId                                                       | Entire reservation fails without changing inventory |
| OrderCancelled         | orders   | catalog.order_cancelled         | orderId, reason (CUSTOMER or RESERVATION_TIMEOUT)             | Cancellation/history/Outbox commit                  |
| OrderConfirmed         | orders   | no subscriber yet               | orderId                                                       | StockReserved changes PENDING to CONFIRMED          |

Routing keys: orders.order_created, catalog.stock_reserved, catalog.stock_reservation_failed,
orders.order_cancelled, orders.order_confirmed. All producers use transactional Outbox and confirms.
No retained subscriber is promised for OrderConfirmed yet; transactional receipt delivery polls orders.
Each active queue has a durable `.retry` (one-second TTL) and `.dlq`. Consumer errors are republished
with a retry count and confirmed before acknowledging the original; after five retries they dead-letter.
An unavailable broker leaves the source unacknowledged for redelivery. Malformed messages are quarantined.

Consumers commit processed_events with state and outgoing events. Order-ID locks and reservation
records also make semantic duplicates with a new eventId safe. A cancellation tombstone prevents late
creation from reserving stock. Five-minute pending expiry emits cancellation; a late reservation response
cannot revive an order. No production payment event is published in stage 4.

## OrderCreated version 2 — equipment extension

New orders publish OrderCreated / 2 using routing key `orders.order_created.v2` and durable queue
`catalog.order_created_v2`. Payload: orderId and items[{productId, variantId, stockUnit (GRAM|PIECE),
stockQuantity (positive integer consumed per item), quantity}]. No price, contact or bearer is published.
Catalog verifies the stock unit/amount against the active variant. All stock rows lock in product-ID
order; mixed carts reserve entirely or emit StockReservationFailed without partial changes.

The v1 event shape and `catalog.order_created` queue are retained for pending historical messages.
Both versions share order/event idempotency. Stock result/cancellation/confirmation events remain v1.
Cancellation reads both old `{productId, grams}` and new `{productId, unit, amount}` reservation rows.
Each versioned consumer has its own retry and DLQ queues. See ADR 0006.

## Online payment events (stage 4a.2, version 1)

Contracts: `packages/contracts/src/payments.ts` and `orders.ts`. No contact details, access tokens,
provider keys, raw callbacks or card data enter these events. All amounts are integer UAH kopecks.

| Event            | Producer | Consumer queue             | Payload                                                      | Trigger                                                                                        |
| ---------------- | -------- | -------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| PaymentRequested | orders   | payments.payment_requested | paymentId, orderId, orderNumber, amount, currency, expiresAt | Online stock reservation commits AWAITING_PAYMENT with a unique attempt and 30-minute deadline |
| PaymentSucceeded | payments | orders.payment_succeeded   | paymentId, orderId, amount, currency                         | Verified callback or reconciliation commits success                                            |
| PaymentFailed    | payments | orders.payment_failed      | paymentId, orderId, amount, currency                         | Verified failure commits; pending order cancels and compensates stock                          |
| PaymentExpired   | payments | orders.payment_expired     | paymentId, orderId, amount, currency                         | Unpaid ledger entry expires; order cancels and compensates stock                               |
| PaymentRefunded  | payments | orders.payment_refunded    | paymentId, orderId, amount, currency                         | Provider-confirmed full refund commits                                                         |
| OrderPaid        | orders   | no subscriber yet          | orderId                                                      | PaymentSucceeded changes AWAITING_PAYMENT to PAID                                              |

OrderCancelled v1 also binds `payments.order_cancelled`. Its existing CUSTOMER/RESERVATION_TIMEOUT
reason contract is preserved; RESERVATION_TIMEOUT covers payment deadline/failure compensation too.
Payment routing keys are `orders.payment_requested`, `payments.payment_succeeded`,
`payments.payment_failed`, `payments.payment_expired`, `payments.payment_refunded`, `orders.order_paid`.
They use the existing durable exchange/retry/DLQ topology and confirmed Outbox publishers.

PaymentRequested/OrderCancelled consumers commit processed markers atomically. Cancellation before
creation leaves a durable order tombstone. Callback/reconciliation observations serialize by order ID;
semantic status transitions produce one outcome even when callback deliveries have no event ID.
Raw callback envelopes, signature validity and outcome are stored in payments_db before rejection;
this audit is deliberately independent of the atomic payment-state/Outbox transaction.

Orders independently verify the attempt ID, amount and currency. Success cannot revive cancellation;
refund cannot regress to paid when a delayed success event arrives. Cancelled/failed/expired payments
with late success queue one durable full refund. Refund jobs are claimed before contacting a provider.
An ambiguous result is quarantined for review/reconciliation rather than automatically resubmitted.

## Attempt changes (stage 4a.3)

PaymentAttemptAbandoned / v1: orders → payments.payment_attempt_abandoned, routing key
orders.payment_attempt_abandoned, payload {orderId, paymentId}. Retry and COD-switch commands publish it
transactionally before a replacement PaymentRequested or OrderConfirmed. Attempt-specific tombstones
handle delivery before creation; whole-order cancellation still affects all attempts. No stock release
is triggered by abandoning one attempt. Late success on it is refunded without touching newer payment
state. Current payment reads use the active attempt ID stored by orders.

PaymentFailed now retains AWAITING_PAYMENT/reserved stock until the original deadline, allowing the
SPEC retry/COD alternative. PaymentExpired still cancels/releases. Known old-attempt outcomes cannot
cancel/pay a newer attempt or COD order. Amount/currency/order membership is verified before ignoring
an obsolete outcome. See ADR 0010 for state and compatibility details.
