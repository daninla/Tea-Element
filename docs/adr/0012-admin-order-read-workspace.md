# ADR 0012 — administrator order workspace

Status: accepted. Date: 2026-11-05.

## Decision

Implement stage 6 incrementally, beginning with an administrator-only order read workspace. Orders-service
owns list/detail reads in a separate administration module with domain ports, application queries, Prisma
adapters and validated RPC handlers. Gateway forwards trusted JWT user ID and role. Both HTTP RolesGuard
and the dedicated RPC envelope require ADMIN. Browser-supplied role/user filters are rejected.

The list has fixed 20-row pages, deterministic createdAt/id ordering, status/payment/account-or-guest
filters, bounded literal contact/number search and optional UTC timestamp boundaries. Count and page
share a repeatable-read transaction. Percent, underscore and backslash in search are escaped before
Prisma contains predicates. The list explicitly selects summary fields. Detail maps immutable order
snapshots and adds only userId and comment; bearer tokens, nonce and request/idempotency hashes never
leave orders-service. Responses are no-store. No service reads another database.

Separate Next.js storefront and admin layouts with a `(store)` route group, preserving every public URL.
The root retains fonts, localization and QueryClient. Admin has a compact sidebar/topbar and its own error
boundary. Middleware checks the ADMIN policy through the gateway instead of decoding unsigned claims
or copying the JWT secret into web. A missing/expired session redirects to login with a constrained
internal return destination. A customer gets a 403 page; an unavailable identity check gets 503. The
client shell independently withholds children until the current session has ADMIN role. API checks remain
the final security boundary. Filters persist in URL state, reset pagination when submitted and rehydrate
on back/forward navigation. Inclusive date inputs use the browser's local day boundaries, sent as UTC;
rendered order timestamps explicitly use Europe/Kyiv. Routes remain noindex/no-referrer.

No schema or dependency change is required. Shipping, completion, paid cancellation/refunds, audit of
mutations and the inventory movement journal remain the next increment. This workspace presents no
status-mutation controls before their transactional inventory/payment workflow exists.

## Validation

Unit/component tests cover forbidden RPC contexts, invalid filters, safe errors, strict date ranges,
constrained login return destinations, fail-closed middleware and suppression of admin children for a
customer. Real HTTP/RMQ/PostgreSQL acceptance adds anonymous/customer denial, UUID validation, secret
field exclusion, literal search, combined filters and disjoint pages of disposable tied-date fixtures.
Existing order access, verification, payment and reservation tests remain active.

Browser acceptance at 375px and 1280px verifies customer denial, admin login, filtered search, detail,
return-filter restoration and bounded table scrolling. Both widths have no horizontal document overflow.
