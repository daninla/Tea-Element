# Architecture overview

The target architecture is Next.js → NestJS gateway → five independent NestJS services.
Only the gateway will expose business HTTP routes; local service HTTP listeners currently expose
liveness and Swagger for development. Gateway has no database. Each domain service owns its database;
PostgreSQL roles cannot connect to sibling service databases. RabbitMQ will provide request-response
and asynchronous domain events. Redis will supply caching and rate limits; Mailpit captures dev mail.

Stage 0 implements the workspace, real HTTP processes, environment validation, structured logging,
correlation IDs, shutdown hooks, Swagger, and development infrastructure configuration.
It does not implement broker transport, database adapters, authentication, orders or payments.
Business API routes will use `/api/v1`; operational `/health` and `/docs` remain outside that prefix.
Liveness is deliberately independent of downstream dependencies.

Modules follow `presentation → application → domain` and `infrastructure → domain`.
The stateless health module has only an application query and a presentation controller.
Add domain and infrastructure layers when actual state and adapters exist.
All external DTOs and event payloads must be shared through contracts, never service imports.
See SPEC sections 4–7 for the target business and trust boundaries.
