# API documentation

Gateway Swagger: http://localhost:4000/docs. Business routes implemented in stage 1:

- `POST /api/v1/auth/register` — CUSTOMER registration and initial session.
- `POST /api/v1/auth/login` — create a session.
- `POST /api/v1/auth/refresh` — rotate the refresh cookie.
- `POST /api/v1/auth/logout` — revoke the current family and clear cookies.
- `GET /api/v1/auth/me` — authenticated public profile.
- `GET /api/v1/admin/auth/me` — ADMIN-only session profile.

Unsafe requests require `Origin: http://localhost:3000` in local development (configurable).
Use cookie credentials; tokens are never returned in JSON. Auth service RPC is internal only.
`/health` is public operational liveness. Internal health/docs use ports 4001–4005 locally.
Other SPEC section 11 endpoints remain planned; they are not implemented as placeholder routes.
