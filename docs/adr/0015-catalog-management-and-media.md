# ADR 0015 — versioned catalog management and processed product media

Status: accepted. Date: 2026-11-05.

## Decision

Catalog-service owns an ADMIN-only catalog-admin module. Domain ports/policies, application use cases,
Prisma/filesystem adapters and validated RPC remain separate. Gateway supplies authenticated actor and
role, while catalog validates that context independently. Products/categories are deactivated rather
than deleted. New products receive empty inventory; receipts stay in the inventory workflow.

Category section and existing product/category slugs are immutable. Products may move only between
categories in the same section. Existing variants retain ID, SKU and gram weight, including inactive
portions; prices/visibility may change and new gram portions may be added. Tea requires distinct positive
gram weights; equipment has exactly one null-weight variant and no brewing guide. An active product
needs an active category and variant. Disabling a category hides its public products. These rules protect
stored order snapshots and late reservation events; earlier orders are never repriced by catalog edits.

Product/category revisions implement optimistic concurrency: a stale expectedRevision returns 409.
A catalog-local transaction advisory lock serializes administrative metadata writes, including concurrent
category visibility changes. This deliberately favors simple invariant enforcement for a small operator
team over high write throughput. Inventory and reservation transactions retain their own inventory-row
locks. Public queries and quotes continue reading current database state; no Redis cache or cache-aside
pattern has been introduced.

Every metadata command has a UUID Idempotency-Key bound to actor and normalized full intent with SHA-256.
Exact retries return the stored result snapshot. Changed payload/actor under the same key returns 409.
Metadata, revision and before/result audit commit together; audit failure rolls back the business change.
Audit reads expose actor/action/time with bounded pages, without command keys or full result snapshots.
No cross-service ProductAdded/PromotionStarted producer is implemented in this increment; these local
changes have no implemented downstream cache/marketing consumer. Future event publication must use Outbox.

The browser persists only key/fingerprint, scoped to actor/entity/operation, and clears it on logout.
An uncertain result can be retried with identical intent. A changed intent requires explicit catalog and
history review, then resets the form before starting a new operation. This is replay protection, not an
autosaved draft. Product/category lists and category choices use bounded, navigable pages.

## Media

Add Sharp as a direct catalog-service dependency to decode, validate, auto-orient, resize and re-encode
actual image bytes. Accept JPEG/PNG/WebP up to 5 MiB and 36 megapixels; reject SVG, animated/multipage
input and undecodable content regardless of declared MIME. Output is metadata-stripped WebP, at most
2000 pixels per side and 2 MiB. The gateway uses a bounded single-file multipart interceptor; global JSON
limits and payment webhook handling remain unchanged.

Opaque UUID filenames prevent caller-controlled filesystem paths. Catalog owns file bytes and database
metadata (actor, SHA-256, size, dimensions). Product paths must be either explicitly bundled assets or
registered uploaded media. Gateway fetches media over catalog RPC, verifies UUID path syntax and emits
WebP with immutable cache headers/ETag. Catalog verifies persisted size/hash before serving. No shared
filesystem between gateway/web and catalog is required. Public media uses a separate bounded read limit
suitable for product galleries. Base64 RPC adds overhead; object storage/CDN is a future deployment choice.

CATALOG_MEDIA_DIR defaults to apps/catalog-service/var/catalog-media and is excluded from Git. A deployment
must mount persistent storage and back up both this directory and catalog_db consistently; a temporary
container filesystem is insufficient. File creation precedes metadata insertion; insertion failure removes
the new file. Filesystem and PostgreSQL do not share an atomic transaction: a process crash may leave an
orphan file, and unused uploaded assets are retained. No automatic garbage collector or distributed media
replication is claimed. Files are not deleted on product deactivation, preserving immutable URLs.

## Validation

Domain/schema/use-case tests cover immutable identities/units, active variants, duplicate portions/IDs,
image path restrictions, trusted actors, price bounds and exact integer currency parsing. Real HTTP/RMQ/
PostgreSQL integration covers new migrations, replay/conflicts, concurrent revision writers, audit failure
rollback, current public prices/stock, category hiding, piece goods, image conversion/public bytes, SVG
rejection, upload limits and pagination. Existing auth, order saga and payment suites remain required.
