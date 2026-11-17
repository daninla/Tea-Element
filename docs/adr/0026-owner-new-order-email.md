# ADR 0026: New-order email for the store owner

Set `ORDER_OWNER_EMAIL` in orders-service to enable alerts for newly created orders. Creation
inserts one dedicated notice in the same transaction as the order and its Outbox row. The notice
reuses the existing leased SMTP worker and per-order dedupe key. No database migration, domain event
or historical backfill is needed. Start updated workers before configuring the address.

The worker uses the configured operator inbox and links to the authenticated admin detail page. The
message includes the order number, total and payment method. It omits buyer contact information and
guest access tokens. The operator checks confirmed payment for online orders and reserved stock for
cash on delivery before shipping. Removing the setting pauses existing owner alerts and disables
queueing new ones. The SMTP delivery guarantees from ADR 0021 apply.
