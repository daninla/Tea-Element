# Catalog service

Stage 6.9: stock consumers accept OrderCancelled v2 (`reason: ADMIN`) as well as v1. Both use the
existing transactional deduplication and release gram/piece reservations without increasing physical
stock. Deploy these compatible consumers before enabling the orders v2 producer. See ADR 0020.

Owns `catalog_db` and its isolated generated Prisma client. Serves catalog read and internal quote RPC on
`catalog.rpc`; HTTP port 4002 exposes only operational `/health` and `/docs`. Public clients use gateway.

## Setup

From the root: `pnpm setup:dev`, `pnpm infra:up`, `pnpm db:migrate`, `pnpm db:seed`, then `pnpm dev`.
`db:seed` provisions the auth admin plus 9 categories, 12 demo teas, 4 equipment products, 40 variants
and 2 promotions. It is transactional and preserves existing rows, prices, inventory and reservations.
Descriptions, origins, years, brewing guides, prices and stock are demo data, not supplier claims.
Seed image paths remain empty; the storefront supplies explicitly illustrative fallback assets. No fabricated sales counts are seeded.

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

## Reservation consumer (stage 4)

`catalog.order_created` and `catalog.order_cancelled` consume durable events from `tea.events`.
`stock_reservations` records each order result; `processed_events` deduplicates each event in the same
transaction as inventory and Outbox. Inventory locks are acquired by sorted product ID. All portions
share gram inventory, including different weights in the same order. Failure reserves nothing and emits
StockReservationFailed; success increments reserved grams and emits StockReserved. Repeated creation
for an existing order never adds another reservation. Cancellation decrements a prior reservation and
records a RELEASED tombstone, protecting against reversed delivery order. Confirmed COD stock remains
reserved until cancellation or OrderShipped deduction (stage 6.2).

Publishers use confirms and durable retry state; consumers retry via TTL queues then quarantine in DLQ.
See [events](../../docs/architecture/events.md) and ADR 0005. Catalog mutation and procurement APIs are described below; no PromotionStarted producer exists yet. Seeds are operational fixtures and emit no events.

## Verification

`pnpm --filter @tea/catalog-service test` covers use-cases, pricing, stock availability and liveness.
After `pnpm build`, `pnpm test:catalog:integration` creates/migrates catalog_stage2_test, seeds twice,
and uses isolated RPC topology and ports 4200/4202. It restores its fixture changes and deletes its queue.
`pnpm test:integration` runs auth, catalog and orders suites. The orders integration verifies real
reservation/cancellation/rollback and concurrency against a separate temporary catalog database. Integration requires local Docker access.

## Teaware and accessories extension

Categories expose `section` (TEA/EQUIPMENT). Product lists accept `section=TEA|EQUIPMENT|ALL`,
defaulting to TEA for unscoped lists; an explicit category without section selects its own section.
Use ALL for cross-section search. Equipment categories are `teaware` and `accessories`.
The idempotent seed now contains 9 categories, 12 teas, 4 equipment products and 40 variants. Existing
rows/prices/gram and piece reservations are preserved. Equipment image paths point to illustrative local
assets; their descriptions, capacities, materials, prices and stocks are synthetic demo data.

Equipment variants have null `weightGrams`, a null product brewing guide and a price per piece.
`stockPieces - reservedPieces` determines availability in both SQL filters and domain mapping; tea still
uses gram counters. A piece is never encoded as one gram. OrderCreated v2 carries explicit units; its
consumer verifies each line against catalog data and reserves all mixed units or nothing. v1 messages
and legacy gram reservations remain compatible. Readonly table grants cover the added columns.

## Shipment deduction and journal (stage 6.2)

OrderShipped consumes only RESERVED gram/piece lines, including legacy grams. Stock and reserve counters,
SALE movements, CONSUMED state, event marker and StockDeducted Outbox commit together. Replays cannot
deduct again; late cancellation cannot release a consumed reservation. Reserve/release journal entries
start now, without fictional backfill. ADMIN stock-movements RPC provides 20-row order-scoped pages.
Invariant failures use retry/DLQ, retaining stock/reserve on rollback. See ADR 0013.

## Purchases and corrections (stage 6.3)

`modules/inventory` owns ADMIN list/detail/history and purchase/adjust commands. Inventory row locking
serializes with reservations/shipment. Purchases infer GRAM/PIECE from category, record supplier/date/
integer total cost and add stock. Adjustments require an expected physical balance and cannot cross
current reservations. UUID command keys bind actor/input; replay returns a persisted result snapshot.
Stock/batch/movement/command audit commit atomically. List/history pages have 20 rows; low-stock filtering
uses available stock and gram/piece thresholds. Manual movements have nullable order/event references.
No new cross-service event or cache is claimed. Valuation remains future work. Configurable thresholds and alert emails were removed from scope
by the owner on 2026-11-08. See ADR 0014.

## Catalog management (stage 6.4)

ADMIN gateway routes: GET/POST `/api/v1/admin/products`, GET/PATCH `/api/v1/admin/products/:id`,
GET/POST `/api/v1/admin/categories`, PATCH `/api/v1/admin/categories/:id`,
GET `/api/v1/admin/catalog/:id/audit?page=1`. Products use 20-row pages with `q`, `section` and `active`;
category choices support bounded `pageSize=1..100`. POST bodies are complete input objects; PATCH uses
`{input, expectedRevision}`. Every metadata write requires a UUID Idempotency-Key. No hard delete exists.
Existing URLs, section/stock unit, variant ID/SKU/weight remain immutable. See ADR 0015 for concurrency,
transactional audit and compatibility rules. Stock changes still use inventory purchase/adjustment commands.

POST `/api/v1/admin/media` accepts multipart field `file`; validated JPEG/PNG/WebP is re-encoded to WebP.
GET `/api/v1/media/:uuid.webp` is public and immutable. Store bytes persistently using CATALOG_MEDIA_DIR
(default `apps/catalog-service/var/catalog-media`); back up it together with catalog_db. Web rewrites
`/media/*` through gateway. Sharp performs bounded decoding, resize/orientation and metadata stripping.
Unused assets remain stored; crash orphan cleanup and object storage/CDN are deployment follow-ups.

## Promotion administration (stage 6.5)

ADMIN GET/POST `/api/v1/admin/promotions`, GET/PATCH `/api/v1/admin/promotions/:id` use catalog-admin RPC.
List supports page/q/active; writes use the same key/revision/audit contract as products. Targets are
1–50 unique `{kind: PRODUCT|CATEGORY, id}` values, validated in catalog_db. Fixed amounts are kopecks;
percent is integer 1–100. Periods are ISO UTC [start,end). Existing public pricing/quote queries apply the
best single active discount without stacking. Disabling never deletes audit. See ADR 0016. PromotionStarted
and marketing publication are deferred to stage 7, not emitted as part of this local administration feature.
