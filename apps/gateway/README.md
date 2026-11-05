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

Stage 4a.3 adds Origin-protected POST /orders/:number/payment/retry|cod (UUID Idempotency-Key) and
/payments/simulate (Fake development only). All require private guest or owner access; neither accepts
an amount or caller-selected payment attempt. Provider callback Origin exemption is unchanged.

## Account endpoints (stage 5)

Authenticated: PATCH `/api/v1/auth/profile`, POST `/api/v1/auth/email/request`, GET
`/api/v1/orders?page=1`. User IDs come exclusively from the verified session. Profile accepts names,
nullable phone and nullable defaultDelivery; email/role fields are rejected.

Public, throttled: POST `/api/v1/auth/email/confirm`, `/api/v1/auth/password/request`,
`/api/v1/auth/password/reset`, `/api/v1/auth/register-from-order`, `/api/v1/orders/lookup`.
Browser Origin protection still applies. Lookup and recovery requests return neutral acknowledgements.
Registration from an order accepts only number, private token, password and optional marketing consent.
Reset clears browser session cookies after the auth transaction succeeds. See ADR 0011.

## Administrator orders (stage 6.1)

GET `/api/v1/admin/orders` and GET `/api/v1/admin/orders/:id` require an ADMIN access JWT. List query:
page (1–10000), q (up to 100 characters), status, paymentMethod, customerType (GUEST/ACCOUNT), from/to
(ISO UTC, inclusive start/exclusive end). Extra keys are rejected. Both routes are no-store and forward
only trusted identity/role context over orders RPC. No status update route is implemented yet.
