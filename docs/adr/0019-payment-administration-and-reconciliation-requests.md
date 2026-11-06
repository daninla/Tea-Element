# ADR 0019 — payment administration and durable reconciliation requests

Status: accepted. Date: 2026-11-06.

Add a payments-owned administration module with domain port/policy, application reads/commands, Prisma
adapter and strict ADMIN RPC. Gateway exposes paginated payment list/detail, provider-event metadata and
reconciliation-request history. Lists support literal order-number/payment-ID search, status, provider,
creation interval and refund-record membership. Filtering/counting precede bounded pagination in the
same Repeatable Read snapshot; only page IDs and safe fields enter application memory. Creation indexes
support global payment/event reads. No sibling database, new dependency or provider call is used by reads.

Never expose raw_payload, hosted checkout fields, signatures, tokens or card/contact callback data through
this UI. Event views select only ID, optional linked payment ID, signature flag, fixed processing outcome
and timestamp. A global event view includes invalid/unattributed callbacks that cannot safely be linked
to a payment card. Refund reads expose current full-refund amount/status/timestamps, including ambiguous
REVIEW_REQUIRED jobs. Provider transaction identifiers are administrative references, not credentials.
COD remains an orders workflow rather than a fabricated online payment attempt.

A manual reconciliation request accepts only payment ID, expected status, reason and UUID command key.
Actor comes from trusted context. It never accepts amount/provider overrides or directly invokes refund.
An advisory key lock serializes replay; the existing order lock protects compatibility with payment
observations/cancellation. Exact same-actor/intent replay returns the original receipt; key reuse conflicts.
A stale status, inactive provider, or terminal REFUNDED/PARTIALLY_REFUNDED state rejects the request.
Scheduling and actor/reason/fingerprint/result audit commit together; any audit error rolls back scheduling.

The new payment_admin_commands table is also a durable wake-up queue. A null attempted_at makes an
eligible payment due even if an overlapping automatic defer moved next_reconcile_at into the future.
Due selection prioritizes pending requests, remains bounded to 20 payments and captures at most 1000
visible request IDs for those payments before polling the provider. Maintenance acknowledges only those
captured IDs in the same transaction as the next automatic schedule. A command committed during a poll
cannot be accidentally acknowledged by that poll and remains due. A crash before acknowledgment leaves
it eligible for another status read. Reads are repeatable; payment observations retain their existing
idempotent state machine and transactional Outbox.

attempted_at records that a provider check was attempted, including provider failure; it does not certify
successful status retrieval, payment or refund completion. The UI makes this distinction explicit. Terminal
states can make an older pending request unnecessary; the card labels that condition rather than claiming
a provider attempt. Unknown provider results never fabricate success. Existing automatic retries, expiry
and ambiguous-refund quarantine remain active, including independently authorized compensation jobs.
The request itself does not create a new operator refund authorization or bypass the order/stock saga.

The browser stores only actor/payment-scoped command key and SHA-256 input fingerprint, clears it on
logout, blocks changed uncertain attempts until history review/reset, and requires reason/confirmation.
A status change resets the form; metadata/background refresh does not silently submit another command.
No manual paid-order cancellation, refund retry, partial refund or stock-return control is claimed here;
those coordinated workflows remain next. Live merchant acceptance and production operations remain open.

Validation covers strict ADMIN context, malformed filters/commands, secret exclusion, unattributed event
reads, literal/status/provider/date/refund filtering, deterministic pages, replay conflicts, provider/terminal
conflicts, captured-ID acknowledgment, in-flight scheduling races and audit rollback. Existing real payment,
order/stock, authentication and catalog integration suites remain required.
