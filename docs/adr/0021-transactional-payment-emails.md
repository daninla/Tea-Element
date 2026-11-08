# ADR 0021: transactional payment emails in orders-service

Status: Accepted, 2026-11-08.

## Context and decision

The existing order receipt provides a private tracking link, but payment receipt and full-refund
confirmation need their own durable delivery. These are transactional messages to the order's email,
including guest orders, independent of marketing consent. Marketing profiles and campaigns remain
stage 7 work. The new `notifications` module uses domain ports, one delivery use case, Prisma/SMTP
adapters and a bounded periodic worker. No new package or cross-service event is necessary.

The orders PaymentSucceeded/PaymentRefunded consumer validates order, known attempt, exact amount and
UAH before enqueueing. Notification insertion, order/attempt updates, history, existing Outbox writes
and the processed-event marker share a transaction. A failed queue insertion rolls back the event
application. The local table is a transactional delivery queue, not a broker publication. It keeps
order/payment references and amount; addresses and private tracking tokens stay in orders-service.

Unique `(payment_id, kind)` keys deduplicate both event replay and semantically identical events with
new event IDs. Known historical attempts can notify about their own received/refunded funds without
changing the active order attempt. A full refund suppresses an unclaimed pending receipt; a known
refund prevents a subsequent delayed success from enqueueing an obsolete receipt. An already sending
receipt can still arrive around the refund message. Templates state historical payment facts and link
to current order status; they never imply shipment, revive cancellation or promise a bank posting time.

## Delivery and failure semantics

Prisma Migrate adds `order_payment_notices` in orders_db. Workers claim due rows using SKIP LOCKED,
increment attempts and assign a random 60-second lease. SMTP runs outside the database transaction.
Only the current lease can acknowledge success/failure; a stale worker cannot overwrite a new claim.
Expired leases recover after crashes. Three failed/expired attempts leave FAILED; failures retry after
5 and 10 seconds. Exhausted crash leases are also marked FAILED. This avoids one failing recipient
blocking later mail and avoids holding database transactions open across SMTP.

SENT means SMTP accepted the message, not that the recipient read it or its mailbox accepted final
delivery. SMTP and PostgreSQL have no shared transaction. A crash after SMTP acceptance and before
acknowledgement can resend; a deterministic Message-ID reduces ambiguity but does not guarantee
exactly-once mailbox delivery. Bounces and a failed-delivery administration/requeue UI remain future
operational work. No raw SMTP error, email address, bearer link or card/provider payload is logged.

The sender provides Ukrainian plain-text and responsive escaped HTML templates. They include the
server-calculated amount, attempt reference and private order link. The demo boundary is explicit.
Existing initial receipts and private lookup emails remain unchanged. No historical mail is backfilled.
Production sender/domain configuration and deliverability acceptance remain external.

## Verification

Unit tests cover empty/successful/failed delivery, stale storage failures, HTML escaping, integer money
formatting and accurate refund wording. The real integration suite verifies SMTP capture in Mailpit
without marketing consent, atomic queue failure rollback, semantic/event deduplication, concurrent
claims, bounded retry, expired-lease recovery, stale acknowledgements and refund-before-success for
known historical attempts. Schema deployment uses a clean temporary integration database; default
read-only grants are checked on the development table.
