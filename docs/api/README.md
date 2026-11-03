# API documentation

Gateway Swagger: http://localhost:4000/docs. Business routes implemented in stage 1:

- `POST /api/v1/auth/register` — CUSTOMER registration and initial session.
- `POST /api/v1/auth/login` — create a session.
- `POST /api/v1/auth/refresh` — rotate the refresh cookie.
- `POST /api/v1/auth/logout` — revoke the current family and clear cookies.
- `GET /api/v1/auth/me` — authenticated public profile.
- `GET /api/v1/admin/auth/me` — ADMIN-only session profile.

Unsafe requests require `Origin: http://localhost:3000` in local development (configurable).
Use cookie credentials; auth tokens are never returned in JSON. Auth service RPC is internal only.
`/health` is public operational liveness. Internal health/docs use ports 4001–4005 locally.
Stage 2 adds public `GET /api/v1/categories`, `GET /api/v1/products` and `GET /api/v1/products/:slug`.
Product query: category, q, origin, minPrice/maxPrice (kopecks), onSale/inStock (true|false),
sort (newest, popular, price_asc, price_desc), page and pageSize. Catalog reads require no cookies.
See catalog-service README for precise price, availability and pagination semantics.
Other SPEC section 11 endpoints remain planned; they are not implemented as placeholder routes.

Stage 4 adds public `POST /api/v1/cart/quote`, `POST /api/v1/orders/guest` with a UUID
Idempotency-Key, private `GET /api/v1/orders/:number?token=` and
`POST /api/v1/orders/:number/cancel?token=`. The creation response contains the guest accessToken;
matching retries return the same order/token. No guest order is accessible by number/email alone.
Authenticated clients also have `POST /api/v1/orders`, `GET/PUT /api/v1/cart` and
`POST /api/v1/cart/merge` (UUID Idempotency-Key). Cart CRUD is exposed through atomic replacement;
additional item-specific convenience routes from SPEC are not implemented. COD only in stage 4.
See orders-service README for validation, statuses, reservation compensation and SMTP behavior.
