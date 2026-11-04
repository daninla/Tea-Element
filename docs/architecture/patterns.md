# Pattern implementation status

| Pattern                          | Current status                                                                         | Source / next work                               |
| -------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------ |
| API Gateway                      | Auth/catalog/orders HTTP-to-RMQ routing, Origin/JWT/RBAC and private bearer access     | apps/gateway/src/modules                         |
| Database per Service             | Five isolated databases; auth/catalog/orders/payments Prisma migrations                | infra/postgres; apps/*/prisma                    |
| Repository / Clean layers        | Domain ports/policies, application use-cases and infrastructure adapters               | modules/auth, catalog, stock, orders             |
| Event-driven architecture        | Registration producer, checkout and payment consumers                                  | shared/outbox; stock/order workers               |
| Transactional Outbox             | State and event commit together; confirmed delivery/retry                              | auth, catalog, orders and payments shared/outbox |
| Idempotent Consumer              | Event marker and side effect share one transaction; order-level semantic dedup         | prisma-stock-store.ts; prisma-order-store.ts     |
| Saga                             | COD/online reservation, payment/deadline and late-refund compensation                  | OrderCreated/StockReserved/OrderCancelled        |
| CQRS-lite                        | Planned                                                                                | SPEC stage 7                                     |
| Strategy                         | PaymentProvider with Fake and LiqPay sandbox adapters; marketing planned               | SPEC stages 4a and 7                             |
| Payment ACL / idempotent webhook | Verified provider observations, durable callback audit and atomic semantic idempotency | SPEC stage 4a                                    |

Orders integration exercises real HTTP, broker and PostgreSQL: duplicate/concurrent submissions,
semantic/event duplicates, rollback after an injected Outbox failure, competing last-stock reservations,
reordered cancellation/creation, expiry and late success. Durable retry queues quarantine poison messages.
Registration separately tests transaction rollback and confirmed delivery. These are at-least-once
messages: correctness comes from idempotent transactions, not a claim of exactly-once delivery.

Private access uses a hashed bearer or trusted owner ID, never order number/email alone. Idempotency
keys and request fingerprints protect checkout and guest-cart merge from uncertain HTTP responses.
JSON snapshots and key-derived guest-token recovery are documented in ADR 0005.
