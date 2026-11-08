# 0024 — Two simple campaigns with audited controls

Status: accepted, 2026-11-08. Supersedes the adaptive interval and subsequent campaign scope in ADR 0023.

The owner requested only discount notifications and reminders after a long absence. WIN_BACK uses
a fixed 30-day boundary after the latest completed order; one reminder per purchase cycle. DISCOUNT
sends one generic notice per active promotion ID, linking to both sale catalogs. No preference model,
consumption estimate, welcome series, editor, preview/test-send flow or audience segmentation is needed.

Catalog exposes a bounded, cursor-based RPC with only ID, title, active flag, dates and revision.
Marketing stores its own snapshots and ignores older revisions. The existing minute worker fetches
up to five 100-row pages per pass and continues next time. Source failure skips sending for that pass;
date eligibility is checked again before SMTP. This deliberately uses polling rather than adding a
new event producer/outbox lifecycle solely for generic emails. Activation/deactivation has eventual
visibility (normally one minute for a small catalog). Already submitted messages cannot be recalled.

Campaign settings default off; persisted rows override the legacy WIN_BACK env fallback. Two ADMIN
switches use optimistic revisions, UUID command keys and actor-bound request fingerprints. The setting,
pending cancellation and audit receipt share one transaction. Replay returns the original result,
changed intent conflicts and stale revisions cannot overwrite another administrator's update.

Scheduling and final SMTP hold the same per-campaign lock as disable; address locks serialize both
rules, consent changes and unsubscribe. Disable cancels pending jobs and waits for any SMTP submission
already in progress. A shared weekly slot records its owning job ID, allowing that job's retries
without letting another campaign's old retry bypass the limit. Only one pending job is scheduled per
profile, with discounts considered first. A cancelled cycle remains cancelled after re-enabling.
The existing leased delivery protocol, bounded retries and SMTP ambiguity described in ADR 0023 remain.

The admin journal pages 20 rows and filters literal email text, rule and status. It exposes safe
delivery metadata only, without unsubscribe proof/nonces, raw errors, private purchase details or
command fingerprints. Client command metadata survives uncertain responses, supports same-intent
retry, and is cleared on logout. No new dependencies or cross-service database access are introduced.

Acceptance uses fresh Prisma migrations, real RMQ/HTTP/Mailpit, switch replay/conflict/audit rollback,
active date bounds, revision ordering, global frequency, opt-out and cancellation on disable, plus
browser checks of the two controls and strict journal layout. Production SMTP remains separate.
