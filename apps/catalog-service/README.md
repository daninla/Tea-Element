# Catalog service

Owns `catalog_db` and its isolated generated Prisma client. Serves read-only business RPC on
`catalog.rpc`; HTTP port 4002 exposes only operational `/health` and `/docs`. Public clients use gateway.

## Setup

From the root: `pnpm setup:dev`, `pnpm infra:up`, `pnpm db:migrate`, `pnpm db:seed`, then `pnpm dev`.
`db:seed` provisions the auth admin plus 7 catalog categories, 12 demo teas, 36 variants (25/50/100 g)
and 2 promotions. It is transactional and preserves existing rows, prices, inventory and reservations.
Descriptions, origins, years, brewing guides, prices and stock are demo data, not supplier claims.
Images intentionally remain empty until storefront assets are added. No fabricated sales counts are seeded.

For new schema changes: `pnpm --filter @tea/catalog-service prisma migrate dev --name <name>`.
Infrastructure script `infra/postgres/catalog-access.sql` provisions catalog_shadow and readonly grants;
it runs on fresh PostgreSQL volumes. Apply it explicitly as the bootstrap role on existing volumes.
Application tables are created exclusively by Prisma Migrate. All tables have UUID id and timestamps.

## Public API via gateway

- `GET /api/v1/categories`: active categories, sort order and active public product counts.
- `GET /api/v1/products`: paginated ProductPage.
- `GET /api/v1/products/:slug`: product with active portions, guide, category and current prices; 404 for hidden/unknown rows.

Query fields: `category` slug, literal case-insensitive `q` (name, original Chinese name, description),
exact case-insensitive `origin`, `minPrice`, `maxPrice` (integer kopecks), `onSale=true|false`,
`inStock=true|false`, `sort=newest|popular|price_asc|price_desc`, `page=1..10000`, `pageSize=1..48`.
Defaults: newest, page 1, pageSize 12. Unknown fields, arrays, malformed booleans/integers and inverted
price ranges return 400. An unknown category returns an empty page. Pagination beyond the end
preserves total and totalPages. All sort orders include a stable id tie-breaker.

The from-price is the lowest price among all active portions, including portions currently out of stock.
Price filters and sorting use this same discounted price. onSale means at least one portion is discounted;
inStock means at least one active portion can be filled. Zero stock does not hide a product.
Available grams = max(0, stockGrams - reservedGrams), shared across all portions.
Inventory totals/reservations, raw promotions and sales counts are not returned publicly.

Promotions apply to a product or category. The best single discount wins; promotions never stack.
PERCENT discount is floored in integer kopecks; FIXED values are kopecks. Prices never fall below zero.
Active time is [startsAt, endsAt). The two demo promotions run from 2026-01-01 to 2030-01-01.
The popularity sort uses persisted salesCount (all zero initially); a sales projection is future work.

The repository computes effective prices in parameterized SQL before filtering/pagination and maps
public views through pure domain pricing rules. Count, page ids and details share a Repeatable Read
snapshot and one time instant. Tests check SQL/domain consistency. Large-catalog search indexing and
Redis caching are deferred; no stale cache is served in this milestone.

No catalog mutation API, stock reservation consumer, purchase/movement journal or PromotionStarted
producer is implemented yet. Seed imports are operational fixtures and do not publish business events.
Those workflows require validated writes, Outbox and idempotency in their respective milestones.

## Verification

`pnpm --filter @tea/catalog-service test` covers use-cases, pricing, stock availability and liveness.
After `pnpm build`, `pnpm test:catalog:integration` creates/migrates catalog_stage2_test, seeds twice,
and uses isolated RPC topology and ports 4200/4202. It restores its fixture changes and deletes its queue.
`pnpm test:integration` runs both the auth and catalog suites. Integration requires local Docker access.
