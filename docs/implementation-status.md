# Implementation status

## Stage 0 — foundation

Implemented: pnpm workspace, Turbo task graph, strict TypeScript, shared ESLint configuration,
Prettier, Husky/lint-staged/Commitlint, Nest CLI monorepo mapping, six NestJS HTTP processes,
liveness endpoints, environment validation, Pino correlation IDs and redaction, Helmet, Swagger,
graceful shutdown, localized Next.js foundation page, PostgreSQL/RabbitMQ/Redis/Mailpit Compose,
optional container application override, shared operational contracts, HTTP tests and CI.

## Remaining stages

1. Authentication and gateway guards.
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

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (18 tests), `pnpm build` and `pnpm format:check` pass.
- `pnpm dev` starts all seven applications; `pnpm health` confirms every process.
- The Ukrainian page was checked at 375px and 1280px; the mobile document has no horizontal overflow.
- Both Compose configurations pass `docker compose config --quiet`.
- Docker access is verified after refreshing the login session. PostgreSQL, RabbitMQ, Redis and Mailpit are running and healthy.
- PostgreSQL created all five service databases; each non-superuser service role has CONNECT access only to its own service database.
- Host port 5432 was occupied, so project PostgreSQL uses `127.0.0.1:5433`; Compose, environment examples and startup documentation agree.

The optional all-container application override has been checked for configuration validity only. No production deployment is included.
