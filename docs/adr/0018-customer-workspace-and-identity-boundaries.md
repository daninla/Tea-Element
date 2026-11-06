# ADR 0018 — customer workspace and identity boundaries

Status: accepted. Date: 2026-11-06.

Provide read-only administrative accounts and guest-contact views with separate bounded pages. Do not
attempt a distributed UNION or pagination across auth_db and orders_db. Auth owns registered CUSTOMER
accounts, including inactive and no-order records; staff ADMIN accounts are excluded from this customer
collection. Orders owns unlinked guest contact groups and purchase history. Both boundaries require
trusted ADMIN context, strict schemas and no-store gateway responses. Auth additionally checks that the
actor still exists as an active ADMIN in auth_db. Gateway never reads a database. No schema, runtime
dependency, cache, ownership mutation or new event is required.

Auth uses an explicit select allowlist: customer ID, email/name/phone, active state, verification and
account-consent timestamps, creation time. Passwords, tokens, login metadata and saved delivery are not
selected for this interface. Literal case-insensitive search and stable createdAt/id order use 20-row
Repeatable Read pages. Missing/noncustomer IDs return 404.

Guest views group only currently unlinked orders by lower(trim(contact email)). Search matches contact
fields from any order while counts and totals retain the full group. Latest contact is selected by
createdAt/id, independently of the requested history page. This is an administrative contact grouping,
not a verified person, authentication credential or marketing opt-in. Email can be present in protected
admin search/profile URLs; it never acts as a guest-order bearer. Existing method-only request logging
and private-session query-cache clearing apply.

Account history uses only exact user_id; guest history uses null user_id plus normalized contact email.
Identical emails never broaden account access or automatically link orders. Verified-email linking
continues through the existing event/proof/cutoff workflow, without new shortcuts. An account with no
orders has empty statistics; an absent guest group returns 404. Account existence is resolved by auth,
while orders returns an empty account scope for an unknown UUID without consulting a sibling database.
The client loads account metadata before its history and preserves independent error states.

Purchase summary reports all order counts and currently completed/paid counts and totals. Refunded,
unpaid or cancelled orders contribute no completed revenue. Top ten actually purchased products use
completed order snapshots, separate gram/piece quantities and stable revenue/ID/unit ordering. These
facts are not an inferred preference model, a provider ledger or permission to send campaigns. Account
consent timestamps are descriptive; no messaging, consent editing or campaign controls are exposed.
Future consent-aware marketing remains stage 7.

The UI preserves URL search/tab/page state and validated internal return paths, uses the shared strict
tables and explicit empty/not-found/unavailable states. Detail order lists have bounded navigation and
link to the existing protected administrative order cards. Both services provide their own consistent
snapshots; the browser does not claim a distributed atomic snapshot or historical identity unification.
For larger datasets the aggregate contact views may need orders-owned projections/index tuning.

Validation covers role/context forgery, active-ADMIN recheck, inactive/no-order customers, secret-field
exclusion, strict selectors, literal search, stable pages, canonical guest email, latest contact, completed/
refunded purchase totals, unit-specific snapshots and disjoint owned/unlinked histories with equal emails.
Existing guest bearer and verified-link integration suites remain required regression checks.
