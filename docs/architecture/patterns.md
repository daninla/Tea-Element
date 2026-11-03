# Pattern implementation status

| Pattern                          | Stage 0 status                                          | Location / next work                                 |
| -------------------------------- | ------------------------------------------------------- | ---------------------------------------------------- |
| API Gateway                      | HTTP boundary foundation                                | apps/gateway; business routing arrives with features |
| Database per Service             | Development databases and isolated roles configured     | infra/postgres/init.sql; Prisma arrives per service  |
| Repository / Clean layers        | Stateless query demonstrates presentation → application | apps/*/src/modules/health                            |
| Event-driven choreography        | Planned                                                 | SPEC stages 4 and 7                                  |
| Saga                             | Planned                                                 | SPEC stages 4 and 4a                                 |
| Transactional Outbox             | Planned                                                 | Add with first state-changing event                  |
| Idempotent Consumer              | Planned                                                 | Add with first consumer                              |
| CQRS-lite                        | Planned                                                 | SPEC stage 7                                         |
| Strategy                         | Planned                                                 | SPEC stages 4a and 7                                 |
| Payment ACL / idempotent webhook | Planned                                                 | SPEC stage 4a                                        |

Configured infrastructure is not evidence of a working distributed transaction. Update this table
with concrete source references and failure-mode tests as each pattern is implemented.
