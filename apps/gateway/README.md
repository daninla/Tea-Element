# Gateway

HTTP boundary on port 4000; no Prisma dependency or database access. `/health` is public liveness;
Swagger is at `/docs`. Business routes use `/api/v1`. Run root `pnpm setup:dev` before starting.

| Method | Path                  | Access                                                 |
| ------ | --------------------- | ------------------------------------------------------ |
| POST   | /api/v1/auth/register | Public, validated RegisterDto; role injection rejected |
| POST   | /api/v1/auth/login    | Public                                                 |
| POST   | /api/v1/auth/refresh  | Public; refresh cookie required                        |
| POST   | /api/v1/auth/logout   | Public; idempotent, clears cookies                     |
| GET    | /api/v1/auth/me       | Valid access JWT                                       |
| GET    | /api/v1/admin/auth/me | Valid ADMIN access JWT                                 |

Controllers delegate to ForwardAuth, which uses the AuthClient port and Nest RMQ adapter.
Global JwtAuthGuard denies by default; @Public is explicit. RolesGuard enforces @Roles and an ADMIN
policy for registered `/api/v1/admin/*` routes. All unsafe requests require Origin equal to CORS_ORIGIN.
The browser sends credentials with requests. Registration accepts optional marketingConsent=false.

Access and refresh credentials are returned only in HttpOnly, SameSite=Lax cookies. Access path is `/`;
refresh path is `/api/v1/auth`. Secure is mandatory in production and disabled for local HTTP development.
No token is returned in the response body. Auth responses use Cache-Control: no-store.
JWT verification restricts HS256, issuer `tea-auth` and audience `tea-gateway`.
CORS defaults to `http://localhost:3000`. Auth/error messages never expose database errors or credentials.
Errors use `{ statusCode, code, message, correlationId }`. RPC correlation IDs are carried to outbox events.

Rate limiting currently uses in-process Throttler storage (30 requests/minute/IP). Liveness is exempt.
A multi-instance deployment needs shared rate-limit storage (planned hardening stage).
No reverse-proxy trust is enabled by default, so X-Forwarded-For cannot bypass rate limits directly.
Swagger lists cookie authentication; for unsafe requests the caller must also supply the allowed Origin.

Use `pnpm test:integration` after a build for end-to-end security and transport verification.
Customer-facing auth pages and Next.js middleware are scheduled with storefront/account features.

## Public catalog (stage 2)

`GET /api/v1/categories`, `/api/v1/products`, `/api/v1/products/:slug` are explicitly public and route
through the catalog module to `catalog.rpc`; gateway has no catalog database dependency. Queries are
validated at both HTTP and RPC boundaries. Catalog reads allow 120 requests/minute/IP/route.
Auth policies and limits remain in effect on authentication endpoints.

## Payments backend (stage 4a.2)

POST `/api/v1/payments/checkout` and GET `/api/v1/payments/status` accept number/token with optional
owner authentication; payments rechecks access through orders RPC. Amounts, owner IDs and redirect URLs
are never accepted from clients. POST `/api/v1/payments/webhook/:provider` accepts only bounded
data/signature fields; `fake`/`liqpay` must match the configured provider. Only this explicitly marked
callback handler bypasses Origin checks and authenticates by provider signature. Its body is never logged.
No payment database/provider integration exists inside gateway. Full workflow is in payments-service.
