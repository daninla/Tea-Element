# catalog-service

Stage 0 service foundation. HTTP liveness: `http://localhost:4002/health`.
Swagger: `http://localhost:4002/docs`. Business features are not implemented yet.

From the repository root: `pnpm --filter @tea/catalog-service dev`.
Optional local overrides: copy `.env.example` to `.env` in this application directory.
Configuration validates the port, CORS origin, environment and log level at startup.
`/health` is process liveness, not database or broker readiness.

Health uses `modules/health/application` and `presentation`, wired in `health.module.ts`.
It has no domain state or external adapters, so those layers are intentionally absent.
Future business modules must follow SPEC section 4.4. Never import a sibling service.

Verification: `pnpm --filter @tea/catalog-service test` (environment validation and HTTP boundary).
