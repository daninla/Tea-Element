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
