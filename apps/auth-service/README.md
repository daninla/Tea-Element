# Auth service

Owns only `auth_db`. Business requests arrive through the durable Nest RMQ queue `auth.rpc`;
HTTP exposes operational `/health` and `/docs` only. Gateway never accesses this database.

## Setup

From the root: `pnpm setup:dev`, `pnpm infra:up`, `pnpm db:migrate`, `pnpm seed:admin`, then `pnpm dev`.
`setup:dev` writes one random shared JWT signing key to ignored app `.env` files and a random admin
password to `apps/auth-service/.env` (mode 0600). It does not print credentials or rotate existing values.
The admin seed preserves an existing ADMIN and refuses to promote an existing CUSTOMER.
The seed account does not opt into marketing and does not emit a customer registration event.

Prisma 6.19 is pinned for the established CommonJS/Node 20 runtime. The generated client is isolated
in this service's ignored `generated/prisma` directory. A future service must generate its own client.
New migrations: `pnpm --filter @tea/auth-service prisma migrate dev --name <name>`.
The `auth_shadow` database is infrastructure, not a second service database. Runtime credentials remain
non-superuser. Existing installations can apply `infra/postgres/auth-access.sql` as the bootstrap role
to provision the shadow database and readonly default grants; do not reset existing volumes.

## Features and failure semantics

`modules/auth` provides Register, Login, Refresh, Logout and GetCurrentUser use-cases.
Passwords use Argon2id; refresh cookies contain 256-bit random opaque values and PostgreSQL stores
only SHA-256 hashes. A refresh operation locks the user row, revokes the old token and inserts a
replacement in one transaction. Reuse of a revoked token commits revocation of the whole family.
Parallel refreshes deliberately fail closed: one succeeds, the second is replay and revokes that chain.
Clients must serialize refresh requests. Logout revokes the current family, not other device sessions.
Access JWTs expire after 15 minutes; logout does not immediately invalidate a previously issued access JWT.
Refresh expiry is seven days from issue and is checked against persisted state.

Registration writes the CUSTOMER, refresh session and UserRegistered outbox row in one transaction.
The publisher uses row locking, SKIP LOCKED, broker confirms, durable messages and exponential retries
(capped at five minutes). Until confirmed, the row stays unpublished. A crash after broker acceptance
can cause duplicate events; future consumers must deduplicate eventId transactionally.
The durable `marketing.user_registered` queue is bound before publication; no marketing consumer is
implemented in this milestone. DLQ topology is ready, but no claim is made about consumer retry behavior.

RPC requests expire in the broker after six seconds and the gateway times out after eight seconds.
They are not automatically retried; a timeout may have an uncertain outcome. Passwords/tokens travel
only over the trusted internal transport and are never logged. Use TLS and private RabbitMQ credentials
outside development. `AUTH_RPC_QUEUE` and `EVENTS_NAMESPACE` allow isolated integration tests.

Stage 5 adds `modules/account`: profile, email confirmation, password recovery and registration from a
private order. Challenges are single-use hashed proofs; the durable SMTP worker sends fragment links to
WEB_URL via SMTP_URL (defaults: localhost:3000 and local Mailpit:1025). Verification commits
UserEmailVerified Outbox atomically. Password reset revokes refresh sessions but existing access JWTs
retain their remaining 15-minute lifetime. ORDERS_RPC_QUEUE supplies private order registration access.
See ADR 0011 for expiry, retry and ownership policy.

## Verification

`pnpm --filter @tea/auth-service test` runs use-case and operational HTTP tests without external services.
After `pnpm build`, `pnpm test:integration` creates/migrates `auth_stage1_test`, starts isolated auth/gateway
processes on ports 4101/4100 and uses isolated broker queues. It cleans its own users, events and topology.
The test database is retained so the next run can exercise migration deployment again.
