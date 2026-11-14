# Pattern implementation status

| Pattern                          | Current status                                                                         | Source / next work                               |
| -------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| API Gateway                      | Auth/catalog/orders HTTP-to-RMQ routing, Origin/JWT/RBAC and private bearer access     | apps/gateway/src/modules                         |
| Database per Service             | Five isolated databases; Prisma migrations for all five services                       | infra/postgres; apps/*/prisma                    |
| Repository / Clean layers        | Domain ports/policies, application use-cases and infrastructure adapters               | modules/auth, catalog, stock, orders             |
| Event-driven architecture        | Registration, checkout, stock, payment and marketing flows                             | shared/outbox; stock/order workers               |
| Transactional Outbox             | State and event commit together; confirmed delivery/retry                              | auth, catalog, orders and payments shared/outbox |
| Idempotent Consumer              | Event marker and side effect share one transaction; order-level semantic dedup         | prisma-stock-store.ts; prisma-order-store.ts     |
| Saga                             | COD/online reservation, payment/deadline and late-refund compensation                  | OrderCreated/StockReserved/OrderCancelled        |
| CQRS-lite                        | Marketing projects opted-in customers and purchases from broker events                 | prisma-campaign-store.ts                         |
| Strategy                         | PaymentProvider with Fake and LiqPay sandbox adapters                                  | SPEC stages 4a and 7                             |
| Payment ACL / idempotent webhook | Verified provider observations, durable callback audit and atomic semantic idempotency | SPEC stage 4a                                    |

Orders integration exercises real HTTP, broker and PostgreSQL: duplicate/concurrent submissions,
semantic/event duplicates, rollback after an injected Outbox failure, competing last-stock reservations,
reordered cancellation/creation, expiry and late success. Durable retry queues quarantine poison messages.
Registration separately tests transaction rollback and confirmed delivery. These are at-least-once
messages: correctness comes from idempotent transactions, not a claim of exactly-once delivery.

Private access uses a hashed bearer or trusted owner ID, never order number/email alone. Idempotency
keys and request fingerprints protect checkout and guest-cart merge from uncertain HTTP responses.
JSON snapshots and key-derived guest-token recovery are documented in ADR 0005.

Catalog and order HTTP fetches use `cache: 'no-store'`. TanStack Query keeps client-side query state
and refetches where configured. Redis is provisioned by Compose. There is no Redis-backed cache-aside
path for catalog reads, and adding one would require defining invalidation for stock and promotion
changes before relying on cached availability or pricing.

The campaign service uses two fixed rules in its scheduler and two mail templates. The replaceable
Strategy boundary in operation is `PaymentProvider` in
[payments/domain](../../apps/payments-service/src/modules/payments/domain/payment-provider.ts).
The marketing projection is implemented in
[PrismaCampaignStore](../../apps/marketing-service/src/modules/campaigns/infrastructure/prisma-campaign-store.ts).
