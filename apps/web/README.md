# Web

Next.js 15 App Router frontend. Stage 0 renders a localized Ukrainian development landing page, not a functioning shop.
`pnpm --filter @tea/web dev` starts port 3000; `GET /health` reports liveness.
Messages live in `messages/uk.json`; locale configuration lives in `src/i18n/request.ts`.
Design colors follow SPEC section 10. System fonts avoid network access during foundation builds;
production typography, storefront, state libraries and forms arrive with their respective features.
No purchase, login or admin links are exposed before their backend exists.
