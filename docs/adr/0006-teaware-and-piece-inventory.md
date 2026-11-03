# 0006 — Teaware and accessories

Status: accepted by the product extension request.

Keep equipment in the existing catalog, cart and ordering flow. Categories have section TEA or
EQUIPMENT; the latter contains teaware and accessories. Public product lists default to TEA for
compatibility and accept section=EQUIPMENT or ALL. An explicit category without section is resolved
within its own section. Cross-section search explicitly uses ALL.

Tea variants retain gram weights and existing stock/reserved gram columns. Equipment variants have
null weight, no brewing guide and independent integer stock/reserved piece columns. Never encode a
piece as one gram. Every equipment variant consumes one piece. Existing fields/rows are preserved;
the additive Prisma migration only makes inapplicable tea fields nullable and adds section/piece fields.

Order JSON snapshots accept null weight for pieces; historical snapshots remain valid. OrderCreated
version 2 carries explicit stockUnit and stockQuantity instead of a mandatory gram weight. It is sent
through orders.order_created.v2 / catalog.order_created_v2. The v1 queue/schema remain active so pending
old Outbox events can still be processed. The consumer verifies requested units against catalog variants,
locks inventory rows by product ID and reserves all tea grams and equipment pieces or none.
Cancellation supports both legacy gram reservations and explicit-unit reservations. No event is rewritten.

Seeds add four illustrative products and two equipment categories idempotently. Prices, descriptions,
stocks and product imagery are demonstration data. No dependencies, new services or databases are added.
