# ADR 0013 — audited fulfillment and stock deduction

Status: accepted. Date: 2026-11-05.

## Decision

Extend the administrator workspace with SHIPPED and COMPLETED commands. Shipment requires CONFIRMED
COD with UNPAID payment or PAID online with PAID payment. Completion requires SHIPPED, a persisted
warehouse acknowledgement, and no refunded online payment. COD completion explicitly records manual
confirmation of delivery and collection, setting paymentStatus to PAID in orders; it does not call a
payment provider or create a fictitious online payment ledger entry.

A command requires a UUID Idempotency-Key, expectedStatus and a 3–500 character reason. Gateway supplies
the verified actor; the RPC boundary independently requires ADMIN. Under the existing per-order advisory
lock, compare the expected status, commit the new status/history, append an admin_order_commands audit
row and write Outbox atomically. A fingerprint includes actor, target, expected state and reason. An exact
replay returns the current detail; changing the command under its key returns 409. This is the same order
lock used by customer cancellation and payment consumers: cancel and ship cannot both commit.

OrderShipped is the administrator's manual fulfillment decision, not a carrier API response. Its catalog
consumer consumes the persisted RESERVED lines, including legacy gram-only reservations. Lock/update
products in stable ID order and require sufficient stock and reserved counters. Decrement both physical
stock and reserve atomically, mark the reservation CONSUMED, append SALE movements, record eventId and
write StockDeducted Outbox. Duplicate event IDs and new-ID duplicates cannot deduct twice. Late creation
or cancellation cannot resurrect/release a consumed reservation. The existing v1/v2 reservation consumers
remain compatible. Reservation/release now append RESERVE/RELEASE movements as well; historical journal
rows are not invented or backfilled.

Orders consumes StockDeducted idempotently and persists stockDeductedAt. Until then the admin UI shows
pending deduction and withholds completion; the server enforces the same condition. Missing/corrupt
reservations, negative-counter risks or transient failures roll back the whole catalog transaction and
use existing retry/DLQ handling. A permanent invariant failure leaves stock reserved and completion
blocked for operational review. Do not automatically cancel/restock an already manually shipped order.
Refund observations after shipment preserve SHIPPED/COMPLETED and update payment state; physical returns
and paid cancellation remain separate future workflows.

Completion writes OrderCompleted with immutable customer/consent and purchased-product snapshots for
the future marketing consumer. A durable marketing.order_completed queue retains these events. No
marketing mail is sent in this increment. Broker payloads contain contact data: keep access private and
never log message bodies. No token, password, admin reason or card details enter these events.

The per-order stock journal is read through a separate ADMIN-validated catalog RPC and gateway endpoint;
orders-service never reads catalog_db. It has fixed 20-row pages, repeatable-read counts and explicit
stock/reserved deltas in GRAM or PIECE units. Product names are current catalog labels; product/order IDs
and movement amounts remain authoritative. Admin detail reads audit/status from a consistent snapshot.

## Validation

Domain tests cover eligibility and pending/refunded restrictions. Component tests require explicit
confirmation and withhold completion pending warehouse response. Real HTTP/RMQ/PostgreSQL tests cover
ADMIN boundaries, concurrent replay/conflicts, Outbox rollback, mixed gram/piece sale, failed warehouse
acknowledgement rollback, duplicate shipment, late cancellation, stock acknowledgement, audited COD
completion, cancel/ship races, legacy gram reservations and server-confirmed online fulfillment.
No real carrier dispatch, payment collection or production deployment is performed.

Browser acceptance at 375px/1280px completed a local mixed COD fixture, showing one 25g deduction,
one piece deduction, collection confirmation, two audited actions and persisted completed status.
The document has no horizontal overflow at either width. No real shipment or funds operation occurred.
