---
name: add-domain-event
description: Use when adding or changing an event exchanged between services via RabbitMQ (for example OrderCreated, StockReserved, PaymentSucceeded). Covers contract, outbox publishing, idempotent consumer and docs.
---

# Add a domain event

Read SPEC.md section 4.2 (Saga, Outbox, Idempotent Consumer) first.

## Steps
1. **Contract:** add the event type and payload interface to `packages/contracts` (PascalCase, past tense). Include `eventId` (uuid), `occurredAt`, `correlationId`. Never put secrets or card data in payloads.
2. **Docs:** add a row to `docs/architecture/events.md` (name, producer, consumers, payload, when emitted).
3. **Producer:** in the use-case, write the domain change AND an `outbox` row in ONE database transaction. Do not publish to RabbitMQ directly from the use-case. The outbox publisher sends it later (at-least-once).
4. **Consumer:** handler must be idempotent: check `processed_events` by `eventId` inside the same transaction as the side effect; skip if already processed.
5. **Failure path:** define what happens on failure (compensating event, retry, dead-letter queue). Saga steps need a compensation.
6. **Queue naming:** `service.event_name`.
7. **Tests:** (a) happy path, (b) same event delivered twice changes nothing, (c) consumer failure triggers retry or compensation.

## Never
- Import another service's code. Use only `packages/contracts`.
- Change an existing event payload in a breaking way; add optional fields or create a new versioned event.
