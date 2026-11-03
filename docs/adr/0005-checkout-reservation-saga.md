# 0005 — Checkout and stock reservation

Status: accepted for stage 4.

Orders own contact/delivery and immutable item/price snapshots. Catalog quotes recalculate current
single-discount prices; only variant IDs and quantities are accepted from browsers. Orders remain
PENDING until catalog reserves all required grams atomically. Confirmed COD orders retain reservations
until cancellation; fulfillment/physical deduction belongs to the administration milestone.

Both services write state and Outbox events together. Consumers record event IDs in the same transaction.
Order-level advisory locks serialize duplicate/reordered cancellation and creation; a released reservation
tombstone prevents a late creation event from reserving cancelled stock. Inventory rows are locked in
product-ID order. Reservation is all-or-nothing and never relies on a prior availability check.
Pending orders expire after five minutes, publish cancellation and compensate late reservations.

Guest tokens are 32-byte HMAC outputs using a server secret and a random 32-byte per-order nonce.
Only the token hash and nonce are stored. This permits the same token to be returned after a lost HTTP
response using the matching idempotency key and request fingerprint, and included in transactional mail
without putting a bearer secret in broker payloads. Rotating this secret invalidates existing guest links.
The UI retains its idempotency key on uncertain failures; changed payloads with the same key return 409.

A durable orders receipt worker sends transactional messages via SMTP (Mailpit locally). This precedes
the marketing milestone and does not subscribe customers. Delivery is at least once: a crash after SMTP
acceptance may resend the same stable Message-ID. Tokens and contact data never enter application logs.

Add Zustand for persisted guest cart IDs/quantities, React Hook Form and its Zod resolver for checkout,
and Nodemailer for transactional SMTP. JSON item snapshots are bounded to 50 lines and simplify immutable
order reads; normalized order-item reporting tables can be introduced when administration needs them.
