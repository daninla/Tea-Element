# ADR 0011 — customer accounts and proof-based guest order linking

Status: accepted. Date: 2026-11-04.

## Decision

Keep account identity in auth-service and order ownership in orders-service. The account module follows
the domain/application/infrastructure/presentation layout. Gateway derives user IDs from verified JWTs;
profile input cannot change email or role. Public registration from an order requires its private token
and obtains contact fields from orders RPC, never from the browser. Registration alone does not link orders.

Registration atomically writes an email challenge with the user, session and UserRegistered Outbox.
Verification atomically consumes the challenge, updates emailVerifiedAt and writes UserEmailVerified.
Orders consumes this event idempotently, retaining a local verified-identity projection and linking only
unowned orders with the same normalized email created no later than the proof timestamp. A periodic
bounded reconciliation handles an order transaction committing after the event. Newer guest purchases
require another email proof. Guest bearer access remains valid independently of account ownership.

Email links carry a UUID and purpose-specific HMAC derived from a random nonce and the existing private
signing secret with a dedicated domain separator. Persist only the digest and nonce; the raw proof is
not returned through HTTP. Links use URL fragments to avoid HTTP request/referrer logs and require an
explicit form submission, so visiting a link does not consume it. Verification expires after 24 hours;
recovery after 30 minutes. Consume under the same user lock as refresh rotation. New requests supersede
older unused challenges with a 60-second cooldown. Rotation of the signing key invalidates pending links.

Durable challenge rows drive an SMTP worker with SKIP LOCKED and persisted exponential retry capped at
five minutes until expiry. Nodemailer is the only new runtime dependency: it sends account mail through
the same SMTP interface already used by orders. Delivery is at least once with a stable Message-ID.
Development targets local Mailpit. No production mail provider acceptance is claimed.

Password recovery returns the same acknowledgement for known and unknown email addresses. A successful
reset consumes all reset challenges and revokes all refresh sessions, without verifying email or linking
orders. Previously issued access JWTs retain their existing maximum 15-minute lifetime. Immediate JWT
revocation remains a separate architecture decision. Private order lookup likewise returns a neutral
acknowledgement and only queues a rate-limited receipt to the matching stored address.

The storefront serializes refresh and session mutations with a per-tab queue and Web Locks across tabs,
rechecks the session after acquiring the lock, and retries an expired request once. Authentication
endpoints never recursively refresh. Logout clears private query caches, owned cart and same-tab order
capabilities. Cart synchronization discards responses from an earlier identity. Middleware redirects
when cookies are absent as a UX aid; every private API independently enforces authenticated ownership.

## Validation and scope

Unit/component tests cover proof binding, registration identity, form validation, safe redirects,
explicit confirmation and concurrent refresh. Real PostgreSQL/RabbitMQ/HTTP suites cover atomic rollback,
proof replay, password recovery, session revocation, neutral lookup, ownership, idempotent event delivery,
proof-time cutoff and reconciliation. Browser acceptance covers local registration, Mailpit verification,
profile and saved delivery, and login/logout at desktop width. The browser viewport API did not apply
the requested 375px override; mobile visual acceptance must be repeated. Production mail, administration,
fulfillment and marketing are later acceptance work.
