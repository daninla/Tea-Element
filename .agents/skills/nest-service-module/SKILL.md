---
name: nest-service-module
description: Use when creating or extending a feature module inside any NestJS service of the Tea Element monorepo (auth, catalog, orders, payments, marketing, gateway). Enforces the domain/application/infrastructure/presentation layout from SPEC.md section 4.4.
---

# NestJS service module

Read SPEC.md sections 4.3 and 4.4 first.

## Layout (inside `apps/<service>/src/modules/<feature>/`)
- `domain/` — entities, value objects, domain events, repository INTERFACES. No NestJS, no Prisma imports.
- `application/` — use-cases (one class per use-case, one public `execute()`), service-level DTOs.
- `infrastructure/` — Prisma repositories implementing domain interfaces, broker clients, external APIs.
- `presentation/` — controllers, message/event handlers, request DTOs (class-validator).
- `<feature>.module.ts` — wires providers; binds interfaces to implementations via injection tokens.

## Rules
1. Dependency direction: presentation -> application -> domain; infrastructure -> domain. Never the reverse.
2. Controllers contain no business logic: validate, call one use-case, map the result.
3. Money is an integer in kopecks. Never use floats.
4. Cross-service data only via `packages/contracts`. Never import another service's code or read its database.
5. State change + event publication go through the Outbox (see skill `add-domain-event`).
6. Add unit tests for every use-case (Jest), next to the file: `*.spec.ts`.
7. Files kebab-case, classes PascalCase. Update the service README when adding a module.

## Done when
`pnpm lint && pnpm test && pnpm build` pass and the module is registered in `app.module.ts`.
