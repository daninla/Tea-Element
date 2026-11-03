# Implementation status

## Stage 0 — foundation

Implemented: pnpm workspace, Turbo task graph, strict TypeScript, shared ESLint configuration,
Prettier, Husky/lint-staged/Commitlint, Nest CLI monorepo mapping, six NestJS HTTP processes,
liveness endpoints, environment validation, Pino correlation IDs and redaction, Helmet, Swagger,
graceful shutdown, localized Next.js foundation page, PostgreSQL/RabbitMQ/Redis/Mailpit Compose,
optional container application override, shared operational contracts, HTTP tests and CI.

## Stage 1 — authentication

Implemented: Prisma auth schema/migration, Argon2id passwords, CUSTOMER registration, login,
15-minute access JWT, hashed seven-day refresh sessions, atomic rotation, family replay revocation,
logout, public profile, cookie/Origin protection, gateway JwtAuthGuard/RolesGuard, ADMIN-only session
endpoint, in-process rate limiting, safe errors, random private development secrets, idempotent admin
seed, RMQ request-response and confirmed UserRegistered Outbox publication.

Integration exercises real HTTP → RMQ → auth → PostgreSQL, concurrent/replayed refresh, expiry,
logout, tampered JWT, RBAC, cookie flags, CSRF, rate limiting, transaction rollback and durable event
publication. A dedicated test database and broker namespace isolate test data.

Explicit follow-up scope: forgot/reset-password and email verification; Next auth forms/middleware;
verified guest linking; shared production rate-limit storage; marketing event consumers. No such
endpoint or UI is presented as implemented.

## Remaining stages

2. Catalog, inventory and Prisma migrations/seed.
3. Storefront and design system.
4. Cart, guest checkout, stock reservation saga, Outbox and idempotency.
   4a. Fake/LiqPay payment providers, verified webhooks, expiry, reconciliation and refunds.
5. Account, verified guest order linking.
6. Administration.
7. Event-based marketing and email.
8. SEO, accessibility, resilience, performance and complete acceptance tests.

The MVP acceptance checklist in SPEC is not yet satisfied. No application schema or business endpoint
is represented as implemented before its milestone.

## Verification in the initial development environment

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (39 tests), `pnpm build` and `pnpm format:check` pass.
- Auth use-case coverage: 100% lines, 98.61% statements, 92.85% branches; real PostgreSQL/RabbitMQ integration passes.
- Auth migration applies to a clean integration database; admin seed runs twice and preserves the existing password.
- `pnpm dev` starts all seven applications; `pnpm health` confirms every process.
- The Ukrainian page was checked at 375px and 1280px; the mobile document has no horizontal overflow.
- Both Compose configurations pass `docker compose config --quiet`.
- Docker access is verified after refreshing the login session. PostgreSQL, RabbitMQ, Redis and Mailpit are running and healthy.
- PostgreSQL created all five service databases; each non-superuser service role has CONNECT access only to its own service database.
- Host port 5432 was occupied, so project PostgreSQL uses `127.0.0.1:5433`; Compose, environment examples and startup documentation agree.

The optional all-container application override has been checked for configuration validity only. No production deployment is included.
