---
name: prisma-migration
description: Use when changing a database schema in any service (new table, column, index) or when writing seed scripts. Ensures per-service databases and Prisma Migrate only.
---

# Prisma migration

## Rules
1. Each service owns its own database and `prisma/schema.prisma` (SPEC.md section 6). Never query or migrate another service's database.
2. Schema changes ONLY via Prisma Migrate: edit `schema.prisma`, then `pnpm --filter <service> prisma migrate dev --name <short_snake_case>`. Never hand-edit the database or committed migrations.
3. Every table: `id` uuid, `created_at`, `updated_at`. Money is `Int` in kopecks.
4. Add indexes for fields used in filters/joins (`slug`, `category_id`, `user_id`, `created_at`, status columns).
5. Destructive changes (drop column/table): do it in two steps (stop using, then remove) and note it in the migration name.
6. Every service with events keeps `outbox` and `processed_events` tables.
7. Seed data lives in `prisma/seed.ts`, uses only fake data (no real emails or phones), and is idempotent (upsert).
8. The `mcp_readonly` role needs SELECT on new tables: verify default privileges apply.

## Done when
Migration applies on a clean database, seed runs twice without errors, `pnpm build` passes.
