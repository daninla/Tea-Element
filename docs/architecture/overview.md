# Architecture overview

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
