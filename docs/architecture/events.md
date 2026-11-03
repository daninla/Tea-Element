# Event catalog

No business events are implemented or published in stage 0.
`packages/contracts` currently exports service identities and HTTP health/error response types only.

Before introducing an event, define its versioned envelope, payload and routing names here and in
contracts, along with producers, consumers, idempotency keys, outbox transaction, retry/DLQ behavior
and data classification. Never publish a guest access token in an ordinary domain event or log.
SPEC sections 4.3 and 14 define the planned events and the implementation milestones.
