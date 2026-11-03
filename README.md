# Tea Element / Чайний елемент

Chinese tea storefront and microservices portfolio project, based on [SPEC.md](SPEC.md).
**Current milestone: stage 0 foundation.** Authentication, catalog, checkout, payments, administration
and marketing are not implemented yet. The frontend clearly labels the shop as under development.

## Start locally (four commands)

Prerequisites: Node.js >=20.19 (Node 22 recommended), pnpm 11.25, Docker Engine with Compose v2.
The current user must have access to the Docker daemon. Ports 3000, 4000–4005, 5433, 5672,
6379, 8025, 1025 and 15672 must be available.

```sh
pnpm install
pnpm infra:up
pnpm dev
# In another terminal:
pnpm health
```

Environment defaults are usable for local development. To override them, copy the application's
`.env.example` to `.env` inside that application directory. Never commit real credentials.
No migrations or seed command is offered until the respective database-backed feature exists.

- Web: http://localhost:3000
- Gateway: http://localhost:4000/health · Swagger: http://localhost:4000/docs
- Service health: ports 4001 (auth), 4002 (catalog), 4003 (orders), 4004 (payments), 4005 (marketing)
- RabbitMQ: http://localhost:15672 (`tea` / `tea_dev`)
- Mailpit: http://localhost:8025

`pnpm infra:down` stops infrastructure and preserves data. For containerized applications, see
[infra/README.md](infra/README.md). `/health` checks process liveness, not downstream readiness.
Services do not connect to infrastructure until business modules are implemented.

## Quality

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Tests exercise each NestJS application through HTTP and reject invalid environment settings.
Turborepo builds contracts before dependent applications. Watch mode uses Nest CLI monorepo projects.
Git hooks use Husky, lint-staged and Commitlint when a writable Git repository is available.
CI repeats quality checks, validates both Compose configurations and smoke-tests all HTTP apps.

## Structure and continuation

`apps/web` contains Next.js 15. `apps/gateway` is the public API boundary. The five domain services
own separate databases: auth, catalog, orders, payments and marketing. Shared contracts live in
`packages/contracts`; shared tooling lives in `packages/eslint-config` and `packages/tsconfig`.
Read [architecture](docs/architecture/overview.md), [milestone status](docs/implementation-status.md),
and [AGENTS.md](AGENTS.md) before continuing. Next milestone: SPEC stage 1, authentication.
