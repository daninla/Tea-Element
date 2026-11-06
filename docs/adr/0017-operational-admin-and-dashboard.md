# ADR 0017 — operational admin tables and bounded dashboard reads

Status: accepted. Date: 2026-11-06.

Admin screens use a scoped operational layout: sans-serif headings, compact spacing, visible input and
cell borders, restrained row contrast, and grouped navigation/actions. All collection views, including
order lines/history, actor audit, purchases/movements and promotion targets, use semantic data tables.
Named keyboard-focusable scroll regions bound long tables, retain headers and contain horizontal overflow.
Product variant fieldsets and image entries remain editable groups with explicit borders. Storefront
visual rules remain outside the admin-shell boundary. No UI dependency is added.

Add a read-only orders-owned dashboard port/use case/Prisma adapter and independent ADMIN-validated RPC.
Gateway exposes GET /api/v1/admin/dashboard?days=1|7|30. The server captures asOf; clients cannot inject
an actor, arbitrary reporting dates or database filters. All query values are parameters. Use a
Repeatable Read transaction and a ten-second query transaction timeout; no shared database, cache,
event publication or schema change is required.

The period begins at Kyiv calendar midnight, spanning today and the previous days-1 calendar dates,
and ends at server asOf. UTC timestamp storage is converted explicitly for Kyiv daily grouping and DST
boundaries. Created-order counts use creation time. Unlinked-order count/share uses current nullable
user_id, so verified guest linking changes that count; this is not a historical checkout-identity flag.

Revenue is operational fulfilled-order revenue: currently COMPLETED and PAID orders, attributed to their
earliest persisted COMPLETED history entry. Online and COD are separate; COD is PAID only after the
existing explicit collection/completion workflow. A paid online order awaiting fulfillment is excluded.
Future completions and currently refunded/cancelled/nonpaid rows are excluded. Repeated completion
history cannot move recognition into a later period. The result is not a provider settlement ledger,
bank statement, profit report or immutable accounting period; later state changes can revise old totals.
Average completed-order value is floored to integer kopecks; empty averages are zero. Reject unsafe or
negative aggregate conversions instead of returning rounded/imprecise values.

Daily totals include zero-sales days. Top ten products rank completed snapshot line revenue with a stable
ID/unit tie-breaker. Quantity is explicitly grams or pieces; names/prices come from order snapshots and
require no catalog database access. Different stock units are never summed into one quantity.

The client independently reads recent orders and bounded low-stock inventory through existing gateway
APIs. These are current global operational widgets, not period-filtered aggregates. A failed widget
shows an error independently; it never replaces missing data with a fabricated zero. Service reads have
independent snapshot times and the UI does not claim a distributed atomic snapshot. Large-scale report
materialization/index tuning remains future deployment work.

Validation covers trusted ADMIN context, strict periods, server clock forwarding, safe aggregates,
completion versus creation dates, online/COD recognition, refund/unfinished/future exclusions, duplicate
history, Kyiv spring/fall DST, empty days/averages and gram/piece ranking. Table structure is tested for
captions, scoped headers and keyboard-scroll accessibility. Existing business workflows remain required
regression checks.
