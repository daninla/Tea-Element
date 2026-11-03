# Development infrastructure

`pnpm infra:up` starts PostgreSQL 16, RabbitMQ, Redis and Mailpit and waits for health checks.
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
