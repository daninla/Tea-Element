# Marketing service

Stage 7.1 owns marketing_db and its Prisma client. Business RPC uses marketing.rpc; HTTP 4005 exposes
health/docs only. No sibling database/source imports exist. See ADR 0023.

Root `pnpm setup:dev` creates a private persistent unsubscribe key; `pnpm db:migrate` includes this
service. `pnpm --filter @tea/marketing-service db:generate` generates its client. Development starts
broker consumers and a bounded campaign worker. SMTP defaults to local Mailpit.

UserRegistered/OrderCompleted project consent and purchases with atomic processed markers and semantic
source IDs. Only actively consented purchase snapshots are retained. A legacy order boolean cannot
subscribe a new profile; new completion events carry optional marketingConsentAt. Unsubscribe cancels
pending mail and clears derived purchases/name, retaining minimal suppression/proof/audit state.
It never changes order access or transactional messages.

WIN_BACK waits at least 30 days or 1.5 times average purchase interval rounded up. One reminder is
allowed per latest purchase, with a global seven-day address slot reserved before SMTP. Three attempts,
backoff and leases use email_logs. Opt-out serializes with final SMTP submission. Stable Message-ID
reduces ambiguity but cannot guarantee exactly-once mailbox delivery; bounce handling is future work.

`MARKETING_WINBACK_ENABLED=false` is the default. Enable only for the intended environment/SMTP
recipient population. This first reminder links to the catalog. Recommendations, promotions, welcome
rules, account consent controls and administration/log pages remain subsequent increments. Production
sender/domain configuration and deliverability are not accepted yet.

The gateway exposes public POST `/api/v1/marketing/unsubscribe` with a signed proof body, trusted Origin
and rate limit. `/unsubscribe#token=...` performs the idempotent operation without login. Tokens never
belong in logs, event payloads or HTTP queries. Preserve MARKETING_UNSUBSCRIBE_SECRET across restarts.

After build, `pnpm test:marketing:integration` exercises a fresh database, real RMQ/HTTP/SMTP, consent
replay/races, SQL scheduling, weekly limits and outage catch-up. Root integration includes five suites.
Automatic approval review requires explicit owner approval for mcp_readonly access to marketing PII;
no such tooling grant is applied. Application functionality uses the marketing owner normally.
