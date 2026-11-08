# Architecture overview

Stage 6.10 adds orders-local transactional payment emails. Payment outcome application and durable
notice enqueueing commit together; leased SMTP workers retry independently without sharing a database
or exposing guest links in broker events. See ADR 0021 for SMTP delivery limits.

Stage 6.9 adds audited ADMIN cancellation before shipment and reuses the reservation-release/full-refund
saga via OrderCancelled v2, preserving v1 consumers. A shared order lock serializes cancellation and
shipment; provider-confirmed refund remains separate from cancellation. See ADR 0020.

The target architecture is Next.js → NestJS gateway → five independent NestJS services.
Only the gateway exposes business HTTP routes; local service HTTP listeners currently expose
liveness and Swagger for development. Gateway has no database. Each domain service owns its database;
PostgreSQL roles cannot connect to sibling service databases. RabbitMQ provides request-response
and asynchronous domain events. Redis will supply caching and rate limits; Mailpit captures dev mail.

The foundation implements the workspace, real HTTP processes, environment validation, structured logging,
correlation IDs, shutdown hooks, Swagger, and development infrastructure configuration.
Stage 1 adds gateway/auth RMQ transport, Prisma-backed authentication, session rotation, RBAC and
transactional UserRegistered Outbox publication. Stage 2 adds catalog RMQ reads, a separate catalog Prisma database/client, portion availability,
current promotion prices and filtered/paginated public product APIs. Stage 3 adds server-rendered Next.js
storefront routes reading only the gateway; TanStack Query powers client search suggestions. URL state
preserves catalog filters and selected portions. Browser prices display server-calculated kopecks;
no browser price is trusted. Stage 4 adds orders RPC, an isolated orders database, fresh catalog quotes,
private guest/owner access, durable order receipts and a reservation/cancellation saga. Orders/catalog
publish through transactional Outbox and consume with atomic processed-event markers. Cancellation
compensates even when creation is delivered late. Confirmed COD reservations await future fulfillment.
Stage 4a.1 adds the internal PaymentProvider boundary with offline Fake and LiqPay sandbox adapters,
current API v7 signing, verified/normalized observations and bounded status/full-refund requests.
Stage 4a.2 adds isolated payments Prisma storage, audit/Outbox/refund jobs and payment consumers.
Gateway payment APIs recheck private order access over RPC. Reconciliation/deadlines and late-money
refund compensation extend the saga without cross-service database reads; see ADR 0009.
Stage 4a.3 adds storefront payment controls, private return access and idempotent multi-attempt/COD
commands. Attempt abandonment compensates late funds without cancelling newer attempts; see ADR 0010.
Stage 5 adds customer account UI, one-use email proofs, password recovery, profile/default delivery
and private order history. UserEmailVerified links historical guest orders through an idempotent
orders projection and reconciliation, with no shared databases; see ADR 0011.
Stage 6.1 adds ADMIN-only order list/detail RPC and a separate browser workspace. Storefront URLs
are preserved through a Next.js route group. Status mutations and physical stock deduction remain
next; see ADR 0012.
Stage 6.2 adds audited/idempotent fulfillment commands, event-driven physical deduction with warehouse
acknowledgement, and a per-order movement journal. Completion waits for persisted deduction; see ADR 0013.
Stage 6.3 adds catalog-local transactional purchases/adjustments, shared-row stock/reserve protection,
stable command replay snapshots and product-scoped inventory history; see ADR 0014.
Stage 6.4 adds versioned product/category editing, immutable portion identities, transactional command
audit and catalog-owned processed image files exposed through gateway; see ADR 0015.
Stage 6.5 adds audited/versioned promotion management with bounded product/category targets and current
server-side best-discount pricing; see ADR 0016.
Stage 6.6 adds an orders-owned bounded operational dashboard, independent stock/recent-order reads and
shared compact administrative tables; see ADR 0017.
Stage 6.7 adds auth-owned customer account reads and orders-owned guest groups/purchase history with
separate identity scopes, bounded pages and a shared administrative UI; see ADR 0018.
Stage 6.8 adds payments-owned administrative ledger/event/refund reads and audited durable requests for
provider-status reconciliation using the existing worker/provider/state machine; see ADR 0019.
Merchant LiqPay sandbox acceptance remains external. Marketing consumers are not implemented yet.
Business API routes use `/api/v1`; operational `/health` and `/docs` remain outside that prefix.
Liveness is deliberately independent of downstream dependencies.

Modules follow `presentation → application → domain` and `infrastructure → domain`.
The stateless health module has only an application query and a presentation controller.
Add domain and infrastructure layers when actual state and adapters exist.
All external DTOs and event payloads must be shared through contracts, never service imports.
See SPEC sections 4–7 for the target business and trust boundaries.

The teaware extension keeps products in catalog-service. Category section distinguishes TEA/EQUIPMENT;
nullable variant weights represent piece goods, with independent stock/reserved piece counters. Mixed
orders use the existing saga with explicit-unit OrderCreated v2, retaining v1 processing and old order
snapshots. No new service/database/dependency is introduced. See ADR 0006.
