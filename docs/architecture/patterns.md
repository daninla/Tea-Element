# Pattern implementation status

| Pattern                          | Current status                                                                 | Source / next work                                                           |
| -------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| API Gateway                      | Auth HTTP-to-RMQ routing and global security guards                            | apps/gateway/src/modules/auth                                                |
| Database per Service             | Five isolated service databases; Prisma auth migration                         | infra/postgres; apps/auth-service/prisma                                     |
| Repository / Clean layers        | Domain ports, application use-cases and adapters                               | apps/auth-service/src/modules/auth                                           |
| Event-driven architecture        | First producer and durable topology; no consumer yet                           | auth-service/src/shared/outbox                                               |
| Transactional Outbox             | Customer, first session and event commit together; confirmed publisher retries | auth-service/modules/auth/infrastructure/prisma-auth-store.ts; shared/outbox |
| Idempotent Consumer              | Planned with the first business consumer                                       | SPEC stage 7                                                                 |
| Saga                             | Planned with checkout                                                          | SPEC stages 4 and 4a                                                         |
| CQRS-lite                        | Planned                                                                        | SPEC stage 7                                                                 |
| Strategy                         | Planned                                                                        | SPEC stages 4a and 7                                                         |
| Payment ACL / idempotent webhook | Planned                                                                        | SPEC stage 4a                                                                |

The Outbox integration test forces a failure at the outbox insert and verifies user/session rollback,
then confirms durable event delivery. Registration has no saga or compensation step.
Consumer idempotency and choreography are not claimed before an actual consumer is implemented.
