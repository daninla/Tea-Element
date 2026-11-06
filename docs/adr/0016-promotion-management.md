# ADR 0016 — audited promotion management

Status: accepted. Date: 2026-11-06.

Extend the catalog-admin module with promotion list/detail/create/update commands. Use the existing
ADMIN gateway/RPC boundary, global catalog metadata transaction lock, revision check, UUID command key,
actor/input fingerprint and atomic before/result audit. Exact replay returns the original saved snapshot;
stale revisions and changed intents conflict. Target replacement and audit are in the same transaction.
No hard delete is exposed; disabling preserves history. A migration adds promotion revision, default zero.

A promotion has a bounded name, integer percent (1–100) or fixed kopecks (1–2147483647), UTC interval
[start, end), enabled flag and 1–50 distinct product/category targets. Every target must exist in catalog.
Hidden products/categories may be targeted without making them public. The UI searches paginated target
choices and displays selected names. Time inputs use the operator device timezone, displayed explicitly;
server contracts persist ISO UTC instants. Scheduled/expired records may be edited or disabled.

Reuse existing effective-price/quote logic: the best single discount wins, percentages floor in integer
kopecks, fixed values apply per portion/piece, and prices never fall below zero. Public queries and fresh
cart/order quotes read current database state; past immutable order prices remain unchanged. No cache
or cache invalidation event is introduced. PromotionStarted publication and consent-aware marketing
consumers belong to stage 7 and are not claimed here; any future publication must use transactional Outbox.

The browser reuses actor/entity-scoped retry metadata and explicit review/reset after uncertain writes.
Reloading the selected record explicitly refreshes its revision; background queries do not erase drafts.
No new runtime dependency is required.

Validation covers exact fixed currency parsing, percentage/date bounds, duplicate/unknown targets,
percent/fixed public prices and server quotes, non-stacking overlaps, disabled/future/expired promotions,
ADMIN-only access, replay conflicts, revision races, audit rollback and bounded literal search/pagination.
