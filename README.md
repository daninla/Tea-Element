# Tea Element / Чайний елемент

Chinese tea storefront and microservices portfolio project, based on [SPEC.md](SPEC.md).
**Current milestone: stage 2 public catalog API.** Authentication, roles and public catalog
with categories, portions, stock availability, promotions, filters and pagination are implemented.
Storefront browsing UI, checkout, payments, administration UI and marketing consumers remain later work. The frontend clearly labels the shop as under development.

## Start locally (five commands)

Prerequisites: Node.js >=20.19 (Node 22 recommended), pnpm 11.25, Docker Engine with Compose v2.
The current user must have access to the Docker daemon. Ports 3000, 4000–4005, 5433, 5672,
6379, 8025, 1025 and 15672 must be available.

```sh
pnpm install
pnpm infra:up
pnpm setup:dev
pnpm db:migrate
pnpm dev
```

Environment defaults are usable for local development. To override them, copy the application's
`.env.example` to `.env` inside that application directory. Never commit real credentials.
The migration command targets auth-service and catalog-service only.
Run `pnpm db:seed` for the local admin and demo catalog (12 teas, 36 portions, 2 promotions). Run `pnpm seed:admin` to provision a
local admin from the private auth-service `.env`; re-running preserves its password.
Check all seven applications from another terminal with `pnpm health`.

- Web: http://localhost:3000
- Gateway: http://localhost:4000/health · Swagger: http://localhost:4000/docs
- Service health: ports 4001 (auth), 4002 (catalog), 4003 (orders), 4004 (payments), 4005 (marketing)
- RabbitMQ: http://localhost:15672 (`tea` / `tea_dev`)
- Mailpit: http://localhost:8025

`pnpm infra:down` stops infrastructure and preserves data. For containerized applications, see
[infra/README.md](infra/README.md). `/health` checks process liveness, not downstream readiness.
Auth and catalog require their own PostgreSQL databases and RabbitMQ. Other domain services remain foundations.

## Quality

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
```

Tests exercise service HTTP boundaries, auth use-cases and Outbox retry semantics.
After building, `pnpm test:integration` verifies real PostgreSQL/RabbitMQ/HTTP auth and catalog behavior using a
dedicated test database and isolated broker queues; Docker must be accessible.
Turborepo builds contracts before dependent applications. Watch mode uses Nest CLI monorepo projects.
Git hooks use Husky, lint-staged and Commitlint when a writable Git repository is available.
CI repeats quality checks, validates both Compose configurations and smoke-tests all HTTP apps.

## Structure and continuation

`apps/web` contains Next.js 15. `apps/gateway` is the public API boundary. The five domain services
own separate databases: auth, catalog, orders, payments and marketing. Shared contracts live in
`packages/contracts`; shared tooling lives in `packages/eslint-config` and `packages/tsconfig`.
Read [architecture](docs/architecture/overview.md), [milestone status](docs/implementation-status.md),
and [AGENTS.md](AGENTS.md) before continuing. Next milestone: SPEC stage 3, storefront.
Forgot/reset-password, email verification and customer auth screens remain documented follow-up work.

## Public catalog examples

After seeding and starting applications, no login is needed:

```sh
curl 'http://localhost:4000/api/v1/categories'
curl 'http://localhost:4000/api/v1/products?category=oolong&onSale=true&sort=price_asc&page=1'
curl 'http://localhost:4000/api/v1/products/tie-guan-yin'
```

All prices, including minPrice/maxPrice query values, are integer kopecks.
See [catalog-service](apps/catalog-service/README.md) for filtering and pricing semantics.
