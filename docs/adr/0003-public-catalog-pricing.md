# 0003 — Public catalog and consistent effective prices

Status: accepted for stage 2.

## Context

Catalog acceptance requires public filtering, sorting and pagination over portion-based pricing and
shared gram inventory. Applying promotions only after pagination would return incorrect pages and counts.

## Decision

Reuse Prisma 6.19.3 with a separate catalog client and database. Add only the same Nest RMQ transport
packages already used for auth; no new framework is introduced. No runtime mutation or event producer
is added in this milestone. Procurement journals and reservation workflows arrive with admin/checkout.

The public price projection uses parameterized SQL with a Repeatable Read transaction for count,
ordered page ids and loaded product relations. Filtering uses effective minimum active-portion price.
Domain mapping uses the same integer rules: best single promotion, no stacking, percentage discount
floored in kopecks, FIXED in kopecks, zero price floor and [startsAt, endsAt) applicability.
SQL/domain parity is verified through PostgreSQL/RMQ/HTTP integration tests.

Availability is derived from stock minus reservations per portion. Inactive categories/products/variants
are excluded; products with no active variants are hidden. Public views never expose raw inventory
or promotions. Search is literal (SQL wildcard characters escaped); all SQL values are parameterized.
Every sort is deterministic. Newest is the default; popular uses a zero-initialized salesCount and
cannot claim historical sales before the future sales projection exists.

## Consequences

The repository has a SQL projection in addition to domain mapping; changes to pricing must update
both and keep the parity tests. Page size/number and query lengths are bounded. No in-memory full
catalog scan is used. No Redis cache is introduced before an invalidation workflow exists.
Demo seed preserves existing records, so intentional data changes need migrations or future admin APIs.
Catalog reads have a 120 requests/minute/IP/route limit; auth keeps its stricter policy.
