# Tea Element contributor instructions

1. Read `SPEC.md`, `docs/architecture/overview.md`, and the relevant application README first.
2. Preserve the repository map from SPEC section 5 and service layout from section 4.4.
3. New business features belong in modules with `domain / application / infrastructure / presentation`. No business logic in controllers. Domain imports neither NestJS nor Prisma.
4. Cross-service events and DTOs belong only in `packages/contracts`. Never import a sibling service or access another service database.
5. State changes with events require transactional Outbox. Every event consumer must be idempotent.
6. Add event types to contracts and document payloads in `docs/architecture/events.md`.
7. Schema changes must use Prisma Migrate. Do not manually modify application database schemas.
8. Add dependencies only when needed and explain their purpose in the PR or an ADR.
9. After changes run `pnpm lint && pnpm test && pnpm build`; also run `pnpm typecheck` and formatting checks.
10. No untracked TODOs or placeholders presented as working behavior.
11. Record significant architectural decisions in `docs/adr/`.
12. Files use kebab-case; classes PascalCase; events past-tense PascalCase (OrderCreated); queues `service.event_name`.
13. Provider integration belongs only in payments-service via PaymentProvider. Reject invalid webhook signatures, make transitions idempotent, and never log keys or payment data.
14. Orders must support nullable user_id. Guest access requires a valid accessToken; an order number alone never grants access. Link past orders only after email verification.
15. Prices, discounts and totals are computed on the server. Money is integer kopecks.

## Current milestone

Stage 4: persisted guest cart, authenticated server cart, guest COD checkout, private tracking,
transactional Outbox and idempotent reservation/cancellation saga. Orders and catalog have migrations
and active business consumers. All storefront orders are demonstration fixtures. Online payment is
stage 4a; customer auth/account UI remains stage 5; fulfillment/admin transitions remain stage 6.
The equipment extension adds `/teaware`, category sections, nullable piece weights, independent piece
inventory and mixed-unit OrderCreated v2; preserve v1 consumer/legacy reservation compatibility.
Read `docs/implementation-status.md` before starting a new milestone.
