# Event catalog

| Event / version    | Producer              | Consumer queue                                                | Payload                                              | Trigger                                  |
| ------------------ | --------------------- | ------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| UserRegistered / 1 | auth-service Register | marketing.user_registered (durable, consumer planned stage 7) | userId, email, firstName, lastName, marketingConsent | Customer and first session are committed |

Contract: `packages/contracts/src/auth.ts`. Envelope: eventId (UUID), name, version, occurredAt (ISO),
correlationId, payload. No password, JWT or guest token is published. Payload contains customer contact
information; keep broker access private and do not log message bodies.

Routing key `auth.user_registered`, topic exchange `tea.events`. Publisher provisioning binds the durable
queue before sending; persistent messages require publisher confirms. Unconfirmed events remain in
`auth_db.outbox` with persisted exponential backoff capped at five minutes. SKIP LOCKED allows multiple
publishers. The update of user, first session and outbox is atomic. A crash after confirmation but before
outbox commit may duplicate delivery: future consumers must record processed_events.event_id inside
their side-effect transaction. No business consumer is implemented yet.

DLX `tea.events.dlx`, queue `marketing.user_registered.dlq`; consumer retry/nack policy will be implemented
with the marketing consumer. No saga or compensation is required for registration in this milestone.
The admin seed is operational provisioning, not a customer-registration event.
