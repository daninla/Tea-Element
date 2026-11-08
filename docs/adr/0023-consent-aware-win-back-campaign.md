# ADR 0023: consent-aware win-back campaign

Status: Accepted, 2026-11-08.

## Scope and ownership

Stage 7.1 establishes marketing-service's Prisma database, event read model, first WIN_BACK rule,
durable email log and unsubscribe flow. Campaigns default disabled (`MARKETING_WINBACK_ENABLED=false`).
Enabling currently requires environment configuration; campaign administration, other rules, account
preference controls and product/category recommendations remain future work. The first reminder links
to the catalog and never fabricates personalized products or discounts. Prisma, Nest RMQ, amqplib and
Nodemailer reuse versions already present in other services; each supplies its database, RPC, broker
or SMTP boundary. No sibling service/database is imported or queried. Outbox is provisioned but no
marketing-owned event is emitted in this increment. Health remains independent of readiness.

## Consent and projection

UserRegistered/OrderCompleted update local state and processed markers atomically. Registration/order
IDs prevent semantic replay with new event IDs from re-subscribing or counting another purchase.
Address grouping is a marketing projection, never identity verification or guest-order ownership.

OrderCompleted v1 adds optional marketingConsentAt from the immutable checkout snapshot. Legacy
boolean consent alone cannot subscribe a new profile. Prior valid registration consent authorizes
subsequent purchases; explicitly checked timestamped checkout consent can opt a guest in. Source
timestamps compare with the last local decision; old events cannot undo a newer unsubscribe. Source
clocks must be synchronized. Invalid/future events retry then dead-letter rather than grant blindly.

Purchases without active consent are not copied. Declines retain minimal suppression/replay state.
Unsubscribe clears derived purchase history and greeting name, cancels pending mail, and retains only
address/nonce/decision and delivery-audit state needed for suppression and old links. Orders and
transactional mail remain unchanged. A genuinely newer explicit opt-in can subscribe again.

## Scheduling and delivery

WIN_BACK becomes due after max(30, ceil(1.5 × average completed-purchase interval)) days; one purchase
uses 30 days. The periodic bounded scanner applies eligibility and cycle exclusion before LIMIT and
rechecks under an address lock. Unique (profile, campaign, latest purchase) logs deduplicate planners.
A fresh purchase cancels an obsolete reminder. A global seven-day address slot is reserved durably
before SMTP, conservatively including failed attempts.

SKIP LOCKED claims use 60-second random leases; stable Message-ID retries use 5/10-second backoff and
at most three attempts. Expired leases recover and exhausted claims fail. Lease-conditional
acknowledgement cannot overwrite a replacement claim. Raw errors, message bodies and bearer URLs
are not logged. Final consent recheck and bounded SMTP submission serialize with unsubscribe under
the same address lock. A submission already running can finish before opt-out returns; a new one
cannot start after a successful opt-out response. This deliberately holds a short transaction across
SMTP. PostgreSQL/SMTP cannot guarantee exactly-once mailbox delivery; crashes after acceptance can
duplicate a retry. Bounces, manual requeue and production deliverability remain open.

## Public boundary and verification

Every text/HTML email has an HMAC-bound unsubscribe link. The proof travels in a URL fragment, which
the page removes, then an Origin-protected/rate-limited POST body through gateway/RMQ. GET has no
side effect. Responses expose no address/profile. Repeated valid requests are idempotent. Persist the
private generated unsubscribe key; never log it or the proof.

Unit/integration tests cover SQL intervals, weekly reservation, replay/rollback, concurrent delivery,
SMTP capture, retry exhaustion, in-flight opt-out, no non-consented purchase history, legacy snapshots
and catch-up after stopping marketing. Browser QA covers campaign preview and unsubscribe without login.

Automatic approval review rejected mcp_readonly SELECT on marketing PII without explicit owner
approval. No such grant is applied or hidden in bootstrap SQL; service-owner application access works
normally. This tooling permission is separate from feature acceptance.
