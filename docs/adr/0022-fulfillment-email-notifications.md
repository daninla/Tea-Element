# ADR 0022: shipment and completion email notifications

Status: Accepted, 2026-11-08.

## Decision

Extend the existing orders-local delivery queue with SHIPPED and COMPLETED notices. An ADMIN status
transition writes its history, administrator audit, existing domain-event Outbox row and notice in one
transaction under the existing order lock. A notice failure rolls back the entire command. An exact
command replay never queues another notice. No new event, dependency, service or broker subscription
is introduced; existing fulfillment permissions and warehouse acknowledgement requirements remain.

Prisma Migrate makes `payment_id` nullable and adds a nullable unique `dedupe_key` to the historically
named `order_payment_notices` table. Existing payment rows retain `(payment_id, kind)` deduplication
with a null dedupe key, so multiple payment attempts for one order remain supported. Status rows use
`order:{orderId}:{kind}` and a null payment ID; they never fabricate an online-payment attempt for a
COD order. The queue remains local to orders_db. Existing rows are preserved and no old mail is backfilled.

The existing leased worker, three-attempt backoff and SMTP sender deliver all four notice kinds.
A COMPLETED row cannot be claimed while that order has a PENDING SHIPPED row, including an in-flight
or delayed retry. Once shipment is SENT or FAILED, completion can proceed. A missing historical shipment
notice does not block a new completion notice. This orders SMTP submission, not final mailbox arrival;
exactly-once delivery remains impossible across PostgreSQL/SMTP. See ADR 0021 for crash/lease semantics.

Messages use the immutable order email for guests and accounts, independently of marketing consent.
Shared Ukrainian HTML/text templates show order number, server-calculated merchandise total and private
tracking link. Fulfillment messages omit the payment-attempt reference and never claim another payment,
invent a carrier tracking number or promise a delivery date. They report a recorded status and link to
current details; a delayed shipment notice does not assert that shipment is the current latest state.
The demonstration boundary covers both payments and shipments.

Upgrade all notice-worker replicas before enabling the extended producer, since older binaries do
not understand status notice kinds with a null payment ID. This development increment is deployed as
one application version; production rolling deployment and sender acceptance remain future operations.

## Verification and scope

Template tests cover shipment/completion wording, null payment references, HTML escaping and unchanged
payment templates. Integration verifies real guest COD and online SMTP delivery without marketing
consent, simultaneous command replay, unique status notices, complete transactional rollback on queue
failure, and shipment-before-completion across an active lease and a scheduled retry. Existing payment
queue crash/retry tests remain required. Browser QA checks real captured HTML/text templates on desktop
and phone previews. No actual email recipient, carrier shipment or payment is used for acceptance.

The owner excluded initiating partial refunds on 2026-11-08. Configurable inventory thresholds and
stock email alerts were already excluded; inventory accounting remains unchanged. Full-refund and
provider-safety handling remain, while paid physical returns/review resolution are separate work.
