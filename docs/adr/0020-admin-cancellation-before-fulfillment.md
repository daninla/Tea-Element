# ADR 0020: administrator cancellation before fulfillment

Status: Accepted, 2026-11-08.

## Decision

Extend the existing ADMIN order transition command with CANCELLED. It requires the current expected
status, a UUID command key and a trimmed reason. Only orders before shipment are eligible: PENDING,
CONFIRMED, AWAITING_PAYMENT, or an online PAID order with PAID payment state. An existing stock-deduction
acknowledgement blocks cancellation. SHIPPED, COMPLETED, REJECTED and CANCELLED are not new transitions.
Customers retain their existing private cancellation boundary; this change does not grant guest or
customer access to cancelling a paid order.

The order advisory lock is shared with shipment and payment-event application. Status, history,
administrator audit and Outbox insertion commit together. A shipment/cancellation race has one winner.
An exact command replay returns the current safe order view without another transition or event;
changed intent with the same key and stale competing commands return 409. Reasons and actor IDs stay
in the administrative audit and do not enter cancellation events.

Publish OrderCancelled **v2**, `{orderId, reason: ADMIN}`, on the existing routing key. Keep the v1
CUSTOMER/RESERVATION_TIMEOUT contract and consumers. Catalog and payments accept both versions and
commit processed-event markers with their effects. Deploy these compatible consumers before enabling
the new producer. No new queue, dependency or schema is necessary.

Catalog releases reserved gram and piece inventory; it does not increase physical stock. Payments
records the existing durable whole-order cancellation tombstone and schedules its existing full-refund
job for received funds. Late successful attempts are covered by the tombstone. Provider confirmation
alone changes payment state to REFUNDED and publishes PaymentRefunded. Delayed PaymentSucceeded cannot
reopen a cancelled order or regress its refunded payment projection.

The refund worker checks the claimed payment's provider against the selected provider before making
an external request. Inactive-provider jobs and uncertain external outcomes go to REVIEW_REQUIRED;
they are never blindly retried. Restarted Fake provider state may require this review despite a
persisted ledger. A cancellation receipt is not evidence of returned money.

The UI requires an unchecked explicit confirmation and reason, links the order to its payment journal,
and distinguishes cancellation, a pending/unconfirmed refund and a provider-confirmed refund. Browser
session storage contains only a command key/fingerprint, scoped to actor/order and cleared at logout.
An unknown response preserves the key and blocks changed intent until the operator reviews the audit.

## Scope and consequences

This increment implements full refunds initiated by cancellation **before shipment**. Physical returns
after shipment, partial refunds, review resolution/retry and refund notification emails remain open.
There is no arbitrary payment amount or provider call in the order API. The existing ledger and
transactional saga remain the authority; no sibling database access is introduced.

The owner removed configurable low-stock thresholds and email alerts from project scope on 2026-11-08.
Inventory accounting and existing dashboard reads remain in scope.

## Verification

Domain/UI tests cover eligibility, explicit confirmation and pending-versus-confirmed refund messaging.
The real payments integration suite exercises ADMIN-only access, input validation, audit/Outbox
rollback, simultaneous replay, v1 compatibility, v2 cancellation of mixed gram/piece reservations,
one full provider refund, delayed success and shipment/cancellation races. Existing compensation,
provider-outage and refund-quarantine tests remain required. Merchant sandbox acceptance is separate.
