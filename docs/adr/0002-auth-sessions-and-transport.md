# 0002 — Auth persistence, sessions and transport

Status: accepted for stage 1.

## Context

The first auth milestone requires real PostgreSQL persistence, RabbitMQ request-response, secure
cookies, rotating sessions, roles and an admin seed without introducing catalog or checkout behavior.

## Decision

Use Prisma 6.19.3 (CommonJS-compatible, supports the repository's Node 20 runtime) and an isolated
per-service generated client. Prisma Migrate owns all application tables. An infrastructure-only
script provisions the restricted migration shadow database and readonly default grants.

Add Argon2 for password hashing; Nest JWT for access-token signing/verification; Nest microservices,
amqplib and amqp-connection-manager for RMQ request-response. Use an amqplib confirm channel for
Outbox topic publications because broker confirmation is part of the publication guarantee.
Add cookie-parser for HTTP cookie parsing and Nest Throttler for the initial single-instance rate limit.
These dependencies implement SPEC requirements; they are not speculative feature libraries.

JWT claims have a 15-minute TTL and explicit issuer/audience/algorithm checks. Refresh tokens are
opaque 256-bit values; only SHA-256 hashes are persisted. Row locking serializes all refresh/logout
operations for a user. Replay revokes the family and commits before the failed authentication reply.
The frontend must serialize refresh calls. Logout leaves existing access JWTs usable until expiry.

Local setup generates private signing/admin secrets. Production boot requires a configured >=32-character
JWT secret; setup refuses to generate production configuration. Cookies are Secure in production;
local HTTP development omits Secure. Every unsafe browser request must match the configured Origin.

UserRegistered is written transactionally with user/session creation. The producer confirms delivery
to durable topology; retry delay is capped, not the number of attempts. Consumer implementations and
consumer idempotency are deferred until marketing work; its queue retains events in the meantime.

## Consequences and scope

Stage 1 delivers the table's registration/login/refresh/logout/RBAC/admin-seed acceptance scenario.
Password reset and email verification endpoints, verified guest linking, Next auth forms/middleware
and distributed rate-limit storage remain explicit work in the account/storefront/hardening stages.
They are not represented by placeholder endpoints. Marketing consent defaults to false.
RPC calls are not retried and have a bounded expiry; a timeout can leave an uncertain response to a
committed registration. Registration uniqueness prevents duplicate users/events on a retry.
