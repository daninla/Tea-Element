# 0001 — Workspace foundation and staged delivery

Status: accepted for stage 0.

## Context

SPEC requires pnpm/Turbo, NestJS monorepo mode, Next.js 15 and five separately owned databases.
The provided workspace has no application source. SPEC section 14 defines independently runnable stages.

## Decision

Use workspace packages per application, a root Nest CLI monorepo project map for watch mode,
and per-application TypeScript builds orchestrated by Turbo. Build contracts before apps.
Use one PostgreSQL development instance with five databases and distinct non-superuser owners.
Base Compose starts infrastructure; the optional dev override adds all seven applications.

Install only dependencies needed in this milestone: Nest HTTP/Swagger/validation, Zod environment
validation, Pino, Helmet, Next/React, next-intl, Tailwind, Lucide, and the specified development tooling.
Prisma, transport clients, authentication, form and state libraries arrive with the features using them.
The foundation landing page uses system fonts to make builds independent of Google Fonts;
SPEC typography and the full design system arrive with the storefront milestone.

## Consequences

The initial repository is runnable without claiming business features are complete. Liveness reports
only the running process; it is not a dependency readiness probe. No fake purchase/authentication APIs
or empty database migrations are exposed. Shared event contracts are introduced together with their
publishers and consumers. Production image hardening and deployment remain later work.
