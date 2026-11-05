# ADR 0014 — purchases and audited inventory adjustments

Status: accepted. Date: 2026-11-05.

## Decision

Add a catalog-owned inventory module with domain rules/ports, application queries/commands, Prisma
adapters and ADMIN-validated RPC. Gateway supplies the trusted actor. The stock/reservation module
continues to own order-event handling; both modules use the same catalog database and inventory rows.
No sibling service database is accessed. Existing stock movement order/event references become nullable
so manual operations can share the journal without inventing order IDs or synthetic domain events.
Existing order-based movements and consumers remain compatible.

A purchase records product, server-inferred unit, positive integer quantity, supplier, purchase date,
reason/note, integer total cost in kopecks and actor. It increases the corresponding physical stock
counter without changing reserve counters. Tea uses grams, equipment pieces; the browser cannot choose
or override units. Zero-cost sample receipts are allowed. Future-dated receipts are rejected except for
five minutes of clock tolerance. These are cost records, not a complete accounting/valuation subsystem.

An adjustment records an explicit signed delta and reason. WRITE_OFF must be negative. expectedStock
must match the locked physical balance, so an operator cannot silently apply a correction to a changed
snapshot. Reservations may change independently: validate the new stock against the current reserved
counter after acquiring the inventory row lock. No change can leave physical stock below zero/reserve,
use fractional quantities, or exceed PostgreSQL Int bounds. Order reservations and shipment deduction
lock the same rows; concurrency cannot make reserved goods available for manual write-off.

Commands require a globally unique UUID Idempotency-Key. An advisory lock serializes that key; a
fingerprint binds kind, product, actor and full normalized input. An exact replay returns the persisted
result snapshot even if later commands changed the balance. Reusing a key with another intent/actor
returns 409. Stock, purchase batch (where applicable), movement and command/result audit commit in one
transaction. Any persistence failure rolls everything back. No direct RabbitMQ publication is involved:
all new effects are local to catalog, with no implemented cross-service consumer/cache requiring an
InventoryChanged event. Existing storefront quotes continue to read fresh server stock. Low-stock email
notifications and broader cache/notification policies remain future work.

ADMIN reads provide deterministic 20-row pages for inventory and product-scoped/global history. Count
and page use repeatable-read snapshots. Search escapes SQL LIKE metacharacters. Include inactive products
for stock management. Low-stock filtering compares available stock (physical minus reserved) with the
existing gram threshold or the new piece threshold (default three). Threshold editing is not part of this
increment. Purchase/movement units are immutable snapshots. Product category changes must preserve
inventory-unit invariants when catalog editing is implemented.

The browser stores only a command key and SHA-256 input fingerprint in sessionStorage, scoped to actor,
product and operation. An uncertain response retains this metadata across reloads; the same payload
reuses its key. A different payload is blocked until the operator reviews history and explicitly starts
a new operation, clearing prior inputs/confirmation. Logout clears this metadata. Sensitive supplier,
cost and note plaintext is not persisted in attempt metadata. Private inventory/history queries are
invalidated after success. Changed balances clear the form confirmation, requiring renewed review.

## Validation

Domain tests cover reserved-stock bounds, integer amounts and future dates. RPC tests reject customer
roles, injected actors, fractional costs and invalid write-offs. Real PostgreSQL/RabbitMQ/HTTP tests use
isolated product fixtures for concurrent/replayed purchases, stable replay snapshots, atomic rollback,
stale/competing adjustments, adjustment-versus-reservation races, piece receipts, hidden products,
literal search, low-stock filtering and paginated batch/journal reads. Browser acceptance at 375/1280px
records a demonstration receipt, rejects reserved-stock write-off, records a permitted write-off and
shows supplier/cost/actor history without horizontal document overflow. No real supplier purchase or
payment operation is made.
