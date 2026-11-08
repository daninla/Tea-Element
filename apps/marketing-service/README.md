# Marketing service

Stage 7.2 owns marketing_db and its Prisma client. Business RPC uses marketing.rpc; HTTP 4005 exposes
health/docs only. No sibling database/source imports exist. See ADRs 0023/0024.

Root `pnpm setup:dev` creates a private persistent unsubscribe key; `pnpm db:migrate` includes this
service. `pnpm --filter @tea/marketing-service db:generate` generates its client. Development starts
broker consumers and a bounded campaign worker. SMTP defaults to local Mailpit.

UserRegistered/OrderCompleted project consent and purchases with atomic processed markers and semantic
source IDs. Only actively consented purchase snapshots are retained. A legacy order boolean cannot
subscribe a new profile; new completion events carry optional marketingConsentAt. Unsubscribe cancels
pending mail and clears derived purchases/name, retaining minimal suppression/proof/audit state.
It never changes order access or transactional messages.

WIN_BACK waits a fixed 30 days after the latest completed purchase, once per purchase cycle.
DISCOUNT sends a generic notice once per currently active promotion ID, linking to tea and teaware
sale catalogs. No recommendation/consumption model, welcome series or manual bulk sends are needed.
Promotion metadata comes from catalog RPC (100/page, max five pages/pass, continued cursor); an RPC
failure skips the sending pass. Changes apply after synchronization, normally the next minute for a
small catalog. Revision checks reject older snapshots; dates are checked again before SMTP.

`/admin/campaigns` has two switches and a filtered/paginated journal. Gateway RBAC and service input
validation protect GET `/api/v1/admin/campaigns`, PATCH `/api/v1/admin/campaigns/:campaign` and GET `/api/v1/admin/email-logs`.
PATCH requires a UUID Idempotency-Key and expectedRevision. Setting, cancellation and actor-bound
command audit commit atomically; replay returns the original receipt and stale updates conflict.
No raw errors, bearer tokens or profile details are exposed by the journal.

Both rules default off. `MARKETING_WINBACK_ENABLED` is the legacy initial fallback only, overridden
by a persisted setting once configured; DISCOUNT has no enablement env. Delivery reserves a shared
seven-day address slot with its owning job ID; one pending job per address, discounts first. Three
attempts, 5/10-second backoff and 60-second leases use email_logs. Opt-out and disable serialize with
bounded final SMTP submission and cancel pending jobs. Cancelled cycles are not automatically resent
when a rule is re-enabled. Stable Message-ID cannot guarantee exactly-once mailbox delivery.
Production sender/domain configuration, bounce handling and deliverability are not accepted yet.

The gateway exposes public POST `/api/v1/marketing/unsubscribe` with a signed proof body, trusted Origin
and rate limit. `/unsubscribe#token=...` performs the idempotent operation without login. Tokens never
belong in logs, event payloads or HTTP queries. Preserve MARKETING_UNSUBSCRIBE_SECRET across restarts.

After build, `pnpm test:marketing:integration` exercises a fresh database, real RMQ/HTTP/SMTP, consent
replay/races, SQL scheduling, weekly limits and outage catch-up. Root integration includes five suites.
Automatic approval review requires explicit owner approval for mcp_readonly access to marketing PII;
no such tooling grant is applied. Application functionality uses the marketing owner normally.
