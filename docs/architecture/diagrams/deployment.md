# Target deployment

```mermaid
flowchart TD
  Browser --> Web[Next.js :3000]
  Web --> Gateway[NestJS Gateway :4000]
  Gateway --> Broker[RabbitMQ]
  Broker --> Auth[Auth]
  Broker --> Catalog[Catalog]
  Broker --> Orders[Orders]
  Broker --> Payments[Payments]
  Broker --> Marketing[Marketing]
  Auth --> AuthDB[(auth_db)]
  Catalog --> CatalogDB[(catalog_db)]
  Orders --> OrdersDB[(orders_db)]
  Payments --> PaymentsDB[(payments_db)]
  Marketing --> MarketingDB[(marketing_db)]
```

This is the target topology. Stage 0 starts independent HTTP processes; broker edges arrive with business features.
