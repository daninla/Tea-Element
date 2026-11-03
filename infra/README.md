# Development infrastructure

`pnpm infra:up` starts PostgreSQL 16, RabbitMQ, Redis and Mailpit and waits for health checks.
PostgreSQL is published on `127.0.0.1:5433` (container port 5432) to coexist with a host PostgreSQL instance.
All published ports bind to localhost. Credentials are development-only.
PostgreSQL initializes five isolated databases with distinct non-superuser owners.
Initialization runs on the first startup of a fresh volume; it never migrates application schemas.
Future schema changes must use Prisma Migrate per service.

Run apps on the host with `pnpm dev`. Internal health ports 4001–4005 are for local development only.
For an optional all-container development environment:

```sh
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d --wait
```

The workspace container installs dependencies once before apps start. The override mounts source for watch mode;
it is not a production image. Each app's node_modules symlinks are written into the mounted source:
use either host development or container development at a time and reinstall when switching.
`docker compose ... down` preserves data. Never delete volumes without confirming data loss.

Auth migrations require the infrastructure-only `auth_shadow` database. On fresh volumes it and
readonly default privileges are provisioned by `postgres/auth-access.sql`. Existing volumes can be
upgraded without deleting data:

```sh
docker compose -f infra/docker-compose.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U tea_bootstrap -d postgres < infra/postgres/auth-access.sql
```

The NOLOGIN mcp_readonly role has SELECT on auth tables and future auth-owned tables. It is not
granted to any login by this project. Runtime service roles remain non-superuser.
