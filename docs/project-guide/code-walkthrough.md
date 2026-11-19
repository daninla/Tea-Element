# Учебный разбор ключевого кода

Эта глава рассчитана на разработчика, который уже пишет JavaScript и React и хочет понять серверную часть проекта. Разбор основан на коде после коммита `0404fc0`. Фрагменты ниже взяты из репозитория; они могут быть частью метода и читаются в контексте файла по ссылке. Это учебные выдержки, а не самостоятельные программы для запуска.

## Что изучать и в каком порядке

| Очередность | Тема                | Что нужно уметь объяснить после чтения                                       |
| ----------- | ------------------- | ---------------------------------------------------------------------------- |
| 1           | Аутентификация      | Как пароль превращается в сессию, почему два token и что дает HttpOnly       |
| 2           | Слои и DI           | Кто вызывает бизнес-правило, где находится PostgreSQL и чем заменить адаптер |
| 3           | RPC и RabbitMQ      | Кто ждет ответа, кто подтверждает сообщение и откуда берется повтор          |
| 4           | Outbox и saga       | Что происходит при падении между БД, брокером и обработчиком                 |
| 5           | Locks и оптимизация | Как два процесса не продают один товар и какие запросы измерять              |
| 6           | Возможности NestJS  | Providers, metadata, guards, pipes, hybrid app и lifecycle                   |
| 7           | Масштабирование     | Когда пригодятся реплики, partitioning и sharding                            |

Первые четыре темы наиболее важны для уверенного объяснения именно этого проекта. Масштабирование разобрано в [отдельной главе с примерами](scaling.md).

## Аутентификация по шагам

Аутентификация устанавливает личность, авторизация проверяет право на конкретное действие. Валидный JWT покупателя не дает права открывать административный заказ или чужую историю.

### Вход и выдача сессии

Сначала откройте [Login](../../apps/auth-service/src/modules/auth/application/login.ts), затем [PrismaAuthStore](../../apps/auth-service/src/modules/auth/infrastructure/prisma-auth-store.ts), [ArgonPasswordHasher](../../apps/auth-service/src/modules/auth/infrastructure/argon-password-hasher.ts) и [JwtAccessTokenSigner](../../apps/auth-service/src/modules/auth/infrastructure/jwt-access-token-signer.ts).

Покупатель отправляет email и пароль через gateway. Auth находит пользователя, проверяет пароль по hash, создает случайный refresh token и выдает подписанный access JWT. В таблицу refresh_tokens попадает hash token. В ответ gateway кладет токены в cookies.

Пароль нельзя восстановить из Argon2 hash. Проверка выполняется функцией verify, которая учитывает параметры hash. Для случайного длинного refresh token используется SHA-256: у такого token высокая энтропия, в отличие от придуманного человеком пароля. Пароли нужно обрабатывать медленным специализированным алгоритмом, а случайные токены можно искать по быстрому криптографическому hash.

В JWT находятся sub, email и role, подпись и временные/служебные claims. Содержимое JWT можно прочитать, поэтому там нет пароля. Подпись защищает целостность, а срок действия ограничивает период применения.

### Проверка access token

[Ключевой файл и строка 37](../../apps/gateway/src/modules/auth/presentation/jwt-auth.guard.ts#L37)

```ts
const decoded: unknown = await this.jwt.verifyAsync(cookie(request, 'tea_access'), {
  secret: readEnvironment().JWT_ACCESS_SECRET,
  algorithms: ['HS256'],
  issuer: 'tea-auth',
  audience: 'tea-gateway',
});
request.user = claims.parse(decoded);
```

`verifyAsync` проверяет подпись и ограничения JWT, включая алгоритм, issuer и audience. `claims.parse` проверяет форму данных после криптографической проверки. Это две разные задачи. UUID в sub и допустимая role нужны для безопасной работы последующего кода. После этого объект request.user становится доверенным контекстом текущего HTTP-запроса.

При анализе безопасности найдите, откуда берется userId бизнес-команды. Он должен приходить из проверенного контекста, а не из произвольного поля тела запроса.

### Почему два token

Access token короткоживущий и проверяется gateway без запроса auth на каждой обычной операции. Refresh token позволяет получить новый access token через проверку сохраненной сессии. При компрометации refresh его семейство можно отозвать в БД. Уже выданный access token может оставаться действительным до окончания срока, если конкретный endpoint не перепроверяет пользователя.

В этом проекте access token живет 15 минут, refresh — семь дней. Страница админки запрашивает текущий профиль через middleware, а admin-shell проверяет роль для отображения UI. Бизнес API заказов использует роль из проверенного access JWT и передает ее в RPC context. Поэтому немедленный отзыв всех административных API-прав после изменения роли без истечения token не следует считать реализованным. Сравните [middleware](../../apps/web/src/middleware.ts), [RolesGuard](../../apps/gateway/src/modules/auth/presentation/roles.guard.ts) и [контроллер заказов](../../apps/gateway/src/modules/orders/presentation/admin-orders.controller.ts).

### Cookies и риски браузера

[Ключевой файл и строка 4](../../apps/gateway/src/modules/auth/presentation/auth-cookies.ts#L4)

```ts
export function cookieOptions(path: string): CookieOptions {
  return {
    httpOnly: true,
    secure: readEnvironment().NODE_ENV === 'production',
    sameSite: 'lax',
    path,
  };
}
```

HttpOnly мешает JavaScript напрямую прочитать token из cookie. Secure включает передачу по HTTPS в production. SameSite=lax ограничивает часть межсайтовых отправок. Path уменьшает область отправки refresh cookie.

HttpOnly не останавливает все последствия XSS: вредоносный скрипт может пытаться отправлять запросы от пользователя. Для изменяющих операций здесь дополнительно проверяется Origin в [OriginGuard](../../apps/gateway/src/modules/auth/presentation/origin.guard.ts). CORS определяет доступ браузерного кода к ответам и сам по себе не заменяет авторизацию или CSRF-защиту.

### Ротация refresh и тонкость с rollback

Откройте [Refresh.execute](../../apps/auth-service/src/modules/auth/application/refresh.ts). Он создает replacement token и вызывает store.rotate. Хранилище блокирует строку пользователя через SELECT FOR UPDATE, проверяет старую запись, отзывает старый token и создает новый в том же семействе.

[Ключевой файл и строка 97](../../apps/auth-service/src/modules/auth/infrastructure/prisma-auth-store.ts#L97)

```ts
if (current.revokedAt) {
  await tx.refreshToken.updateMany({
    where: { familyId: current.familyId, revokedAt: null },
    data: { revokedAt: now },
  });
  // Return, do not throw: revocation must commit even though authentication fails.
  return { kind: 'replayed' };
}
```

Допустим, старый token уже использовали, а затем он пришел повторно. Это может быть кража или конкурентный refresh из другой вкладки. Сервис отзывает активные записи семейства.

Если после updateMany выбросить ошибку внутри `$transaction`, PostgreSQL откатит отзыв сессий. Поэтому хранилище возвращает `replayed`, завершает commit, а application-слой выбрасывает INVALID_SESSION уже после возврата из rotate. Это пример, где место выбрасывания исключения меняет безопасность системы.

Два легитимных параллельных refresh тоже могут выглядеть как replay. Поэтому на клиенте требуется сериализация обновления. Посмотрите [API auth](../../apps/web/src/lib/api/auth.ts) и [session-lock](../../apps/web/src/lib/api/session-lock.ts), затем [refreshSession](../../apps/web/src/lib/api/orders.ts). Последний повторно читает /auth/me после ожидания lock, поскольку другая вкладка могла уже обновить cookies. При отсутствии Web Locks остается очередь Promise внутри одной вкладки; межвкладочная сериализация в таком браузере слабее.

### Роли и гостевой доступ

[RolesGuard](../../apps/gateway/src/modules/auth/presentation/roles.guard.ts) проверяет роль; [PrismaOrderStore.accessible](../../apps/orders-service/src/modules/orders/infrastructure/prisma-order-store.ts) проверяет принадлежность заказа или гостевой bearer token. Проверка роли и проверка владельца сущности нужны вместе.

Гость может заказать без аккаунта. Совпадение email не доказывает владение адресом. Привязка прошлых заказов проходит после UserEmailVerified, через [AccountOrders](../../apps/orders-service/src/modules/orders/application/account-orders.ts). Иначе любой мог бы зарегистрироваться на чужой адрес и прочитать историю покупок.

**Упражнение.** Проследите запрос входа до Set-Cookie. Затем объясните, почему logout отзывает refresh, а срок доступа старого JWT зависит от конкретного вида проверки. Найдите тесты refresh в [auth application](../../apps/auth-service/src/modules/auth/application) и сквозные сценарии в [test-auth-integration](../../scripts/test-auth-integration.mjs).

## Архитектурные паттерны на конкретном запросе

### Ports and Adapters и Dependency Inversion

[Ключевой файл и строка 8](../../apps/orders-service/src/modules/orders/application/create-order.ts#L8)

```ts
constructor(
  @Inject(OrderStore) private readonly store: OrderStore,
  @Inject(QuoteProvider) private readonly catalog: QuoteProvider,
  @Optional() @Inject(CheckoutDelivery) private readonly delivery?: CheckoutDelivery,
) {}
```

CreateOrder просит хранилище сохранить заказ и QuoteProvider получить цены. Он не создает PrismaClient и не выбирает RabbitMQ transport. Эти детали предоставляет Nest-модуль.

[Ключевой файл и строка 52](../../apps/orders-service/src/modules/orders/orders.module.ts#L52)

```ts
{ provide: OrderStore, useClass: PrismaOrderStore },
{ provide: QuoteProvider, useClass: RmqQuoteProvider },
```

`OrderStore` — runtime token абстрактного класса. Обычный TypeScript interface стирается после компиляции, поэтому его нельзя просто передать в `@Inject`. Для interface понадобился бы отдельный Symbol или string token. Здесь абстрактный класс одновременно описывает контракт и существует в runtime.

PrismaOrderStore можно подменить fake-реализацией в unit-тесте. Бизнес-сценарий при этом проверяется независимо от PostgreSQL. Но unit-тест с mock-хранилищем не доказывает правильность транзакции и SQL-блокировки. Для этого нужны интеграционные проверки.

### Repository и Unit of Work

Хранилище скрывает детали доступа к данным и выполняет операции над заказом. `$transaction` ограничивает единицу атомарной работы. Отдельного универсального UnitOfWork-класса проект не вводит. В PrismaOrderStore локальная транзакция прямо связывает snapshot, историю, Outbox и очередь письма.

### Идемпотентная команда

[Ключевой файл и строка 98](../../apps/orders-service/src/modules/orders/infrastructure/prisma-order-store.ts#L98)

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key.idempotencyHash},0))`;
const existing = await tx.order.findUnique({
  where: { idempotencyHash: key.idempotencyHash },
  include: { history: { orderBy: { createdAt: 'asc' } } },
});
if (existing) return this.response(existing, input, context);
```

Два одинаковых запроса могут прийти до того, как первый закончил вставку. Одна проверка findUnique без сериализации оставляет окно гонки. Advisory lock связывает одинаковый hash с одной критической секцией. После получения lock повторное чтение видит результат предыдущей транзакции.

Уникальное ограничение БД остается дополнительной защитой. В response сравнивается requestHash: повторный ключ с другими товарами должен дать конфликт, а не молча вернуть другой заказ.

### Outbox и окно падения

[Ключевой файл и строка 149](../../apps/orders-service/src/modules/orders/infrastructure/prisma-order-store.ts#L149)

```ts
await this.event(tx, event);
if (readEnvironment().ORDER_OWNER_EMAIL) await enqueueOrderNotice(tx, row, 'OWNER_NEW_ORDER');
```

Обе операции находятся внутри уже открытой `$transaction`. Письмо владельцу и исходящее событие не должны фиксироваться отдельно от заказа. Прочитайте весь create, затем [OutboxPublisher.flush](../../apps/orders-service/src/shared/outbox/outbox-publisher.ts).

Рассмотрите три места падения. До commit локальной транзакции заказ и Outbox откатываются вместе. После commit до публикации событие остается в Outbox. После подтверждения брокера до фиксации publishedAt возможна повторная публикация. Это последняя причина, по которой idempotent consumer обязателен даже с надежным publisher.

### Saga и semantic idempotency

Состояния заказа, склада и оплаты меняются в разных БД. Компенсация освобождает резерв или оформляет технический возврат, если обычный путь уже невозможен. Это не откат одной общей PostgreSQL-транзакции.

В [PrismaStockStore.apply](../../apps/catalog-service/src/modules/stock/infrastructure/prisma-stock-store.ts) ищите сначала order lock, затем processedEvent и существующий reservation. Event ID защищает от повторной доставки сообщения. Reservation по order ID защищает от второго бизнес-эффекта с другим event ID. Tombstone защищает от перестановки отмены и создания. У этих проверок разные причины существования.

### Strategy и защита домена от внешнего API

Сравните [PaymentProvider](../../apps/payments-service/src/modules/payments/domain/payment-provider.ts), [FakePaymentProvider](../../apps/payments-service/src/modules/payments/infrastructure/fake-payment-provider.ts) и [LiqPayProvider](../../apps/payments-service/src/modules/payments/infrastructure/liqpay-provider.ts). У них общий интерфейс, но разные форматы и способы получения результата.

Адаптер преобразует данные провайдера в PaymentObservation, чтобы state machine не разбирала внешний JSON в каждом use case. Для собеседования полезно объяснить и Strategy выбора поведения, и Anti-Corruption Layer перевода внешних понятий.

## RabbitMQ без пропусков между понятиями

### Exchange, routing key, queue, consumer

Publisher отправляет сообщение в exchange с routing key. Binding определяет, в какие queues попадет копия. Consumer забирает сообщения из своей queue. Несколько потребителей одной queue делят работу; разные сервисы, которым нужен один факт, получают собственные queues с binding к тому же routing key.

Например, отмена нужна catalog для освобождения запаса и payments для компенсации. Если посадить их на одну queue как конкурирующих consumers, каждый факт получит лишь один из сервисов, и workflow будет неполным. Фактические bindings задаются в [контрактах заказов](../../packages/contracts/src/orders.ts) и [RabbitEventBus.connect](../../apps/orders-service/src/shared/outbox/rabbit-event-bus.ts).

### RPC через NestJS

[Ключевой файл и строка 13](../../apps/gateway/src/modules/orders/infrastructure/rmq-orders-client.ts#L13)

```ts
return await firstValueFrom(
  this.client.send<OrdersResult<T>, OrdersRequest<unknown>>(pattern, request).pipe(timeout(8000)),
);
```

`ClientProxy.send` возвращает Observable ответа. `firstValueFrom` подписывается и преобразует первый ответ в Promise. `timeout(8000)` ограничивает ожидание клиента. Таймаут не отменяет уже выполненную транзакцию удаленного сервиса. Для повторной команды по-прежнему нужен тот же idempotency key. Семантика send/request-response описана в [Nest microservices](https://docs.nestjs.com/microservices/basics).

### Почему режим RPC отличается от событий

[Ключевой файл и строка 25](../../apps/orders-service/src/main.ts#L25)

```ts
app.connectMicroservice<MicroserviceOptions>({
  transport: Transport.RMQ,
  options: {
    urls: [env.RABBITMQ_URL],
    queue: env.ORDERS_RPC_QUEUE,
    queueOptions: { durable: true, messageTtl: 6000 },
    noAck: true,
    prefetchCount: 10,
  },
});
```

В Nest RPC включен noAck=true. Значение prefetchCount в этом режиме не обеспечивает такого ограничения unacked deliveries, как ручное подтверждение. RPC также использует request/reply и короткий message TTL. Это компромисс текущей реализации: RPC-команда сама не получает все гарантии повторной обработки событийной очереди.

Для бизнес-событий используется собственный amqplib-код с noAck=false и prefetch(1). При ручном ack брокер может вернуть сообщение после потери соединения. Для RPC при потере ответа клиент получает ошибку и повторяет безопасную команду через idempotency. Эти режимы нужно оценивать отдельно. [Подтверждения RabbitMQ](https://www.rabbitmq.com/docs/confirms).

### Ack после локального commit

[Ключевой файл и строка 107](../../apps/orders-service/src/shared/outbox/rabbit-event-bus.ts#L107)

```ts
await handler(JSON.parse(message.content.toString()) as unknown);
channel.ack(message);
```

handler должен разрешить Promise после завершения транзакции. Если процесс умрет после commit до ack, сообщение придет повторно, а processed_events не даст повторить эффект. Если ack выполнить до commit и процесс упадет, брокер уже может удалить сообщение, хотя бизнес-данные не сохранились.

Consumer ack подтверждает обработку сообщения. Publisher confirm подтверждает прием публикации брокером. Publisher не получает из confirm доказательство выполнения consumer. [Publisher confirms](https://www.rabbitmq.com/docs/publishers).

### Prefetch и backpressure

В RabbitEventBus задан prefetch(1). В стандартной модели RabbitMQ это ограничение применяется к consumer; оно не означает одну глобальную операцию на все очереди сервиса. Консервативный размер уменьшает число незавершенных обработок, но может ограничивать throughput.

При повышении prefetch растет потенциальное число параллельно ожидающих БД-операций. Сначала измеряют очередь и время обработки, затем согласуют prefetch, число replicas приложения и pool соединений. Большой prefetch при перегруженной БД способен увеличить latency. [Consumer prefetch](https://www.rabbitmq.com/docs/consumer-prefetch).

### Retry и DLQ

[Ключевой файл и строка 110](../../apps/orders-service/src/shared/outbox/rabbit-event-bus.ts#L110)

```ts
const attempts = Number(message.properties.headers?.['x-checkout-attempt'] ?? 0);
if (attempts >= 5) {
  channel.nack(message, false, false);
  return;
}
```

В deliver ошибка приводит к отправке копии в queue.retry с увеличенным заголовком x-checkout-attempt. После подтверждения публикации копии исходное сообщение ack-ается. Retry queue имеет TTL 1000 мс и dead-letter routing обратно в exchange. При исчерпании попыток nack с requeue=false направляет сообщение в DLQ согласно топологии.

Если публикация retry не подтверждена, original не должен теряться. Если retry был подтвержден, но original ack потерян, обе копии могут быть доставлены позже. Поэтому обработчик по-прежнему идемпотентный. Из кода следует пять повторов после исходной попытки. Причину DLQ нужно исправить перед контролируемым replay.

Durable queue и persistent message улучшают сохранность, но один брокер остается точкой отказа. Настройки queue type, дисков и кластера нужно проверять отдельно. Confirm без нужного binding также не доказывает доставку нужному подписчику: топология должна существовать до публикации. В коде queues/bindings создаются через assert/bind.

### Порядок сообщений

Общего порядка между разными очередями и сервисами нет. Redelivery и несколько consumers могут изменить порядок завершения даже при последовательной отправке. Наши handlers должны корректно обрабатывать позднюю отмену, позднюю оплату и дубликаты. Сериализация по order ID защищает локальную транзакцию, но не делает очередь глобально последовательной.

**Упражнение.** На отдельном тестовом окружении остановите broker после сохранения заказа, проверьте Outbox, затем восстановите его и проследите event ID до processed_events. Не выполняйте упражнение на рабочем магазине. Основу для стенда дает [test-orders-integration](../../scripts/test-orders-integration.mjs).

## Продвинутые возможности NestJS в проекте

### Custom providers и useFactory

[PaymentProvidersModule](../../apps/payments-service/src/modules/payments/payment-providers.module.ts) выбирает адаптер фабрикой по env. [OrdersModule](../../apps/orders-service/src/modules/orders/orders.module.ts) использует useClass. useValue удобно подставляет готовый mock в тесте, useExisting позволяет дать второе имя существующему provider. Последние два приема здесь приведены как возможности Nest для развития тестов. [Custom providers](https://docs.nestjs.com/fundamentals/custom-providers).

### Reflector, decorators и guards

[Ключевой файл и строка 26](../../apps/gateway/src/modules/auth/presentation/jwt-auth.guard.ts#L26)

```ts
const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC, [
  context.getHandler(),
  context.getClass(),
]);
const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH, [
  context.getHandler(),
  context.getClass(),
]);
```

Декоратор Public вызывает SetMetadata. Guard читает metadata метода и класса через Reflector, определяет политику, затем извлекает HTTP request из ExecutionContext. getAllAndOverride задает приоритет метода над классом. Порядок global guards важен: роль проверяется после того, как JwtAuthGuard создал request.user. Регистрация через APP_GUARD сохраняет доступ к DI. [Guards NestJS](https://docs.nestjs.com/guards).

### Pipes и runtime-валидация transport boundaries

В [main.ts orders](../../apps/orders-service/src/main.ts) установлен ValidationPipe с whitelist, forbidNonWhitelisted и transform. На HTTP DTO применяются декораторы class-validator. Rabbit-сообщения дополнительно проверяются Zod в RPC-контроллерах и workers. TypeScript сам не проверяет JSON из сети.

[Ключевой файл и строка 8](../../apps/orders-service/src/modules/orders/presentation/order-worker.ts#L8)

```ts
const stockSchema = z
  .object({
    eventId: z.string().uuid(),
    version: z.literal(1),
    occurredAt: z.string().datetime(),
    correlationId: z.string().min(1).max(100),
    name: z.enum(['StockReserved', 'StockReservationFailed', 'StockDeducted']),
    payload: z.object({ orderId: z.string().uuid() }).strict(),
  })
  .strict();
```

Здесь проверяются enum name, version, UUID и payload, а strict запрещает лишние поля. Глобальные HTTP guards/pipes нельзя автоматически считать политиками всех microservice handlers. Hybrid app имеет отдельную transport-границу; в этом проекте явная проверка RMQ payload остается необходимой.

### Hybrid application

Один Nest-процесс orders одновременно поднимает HTTP health/docs и RMQ listener через connectMicroservice. Gateway выполняет бизнес HTTP вход, а доменный сервис принимает команды по RMQ. Это позволяет наблюдать процесс через HTTP без публикации всех бизнес-контроллеров наружу.

### Lifecycle и безопасный worker

[Ключевой файл и строка 11](../../apps/orders-service/src/modules/notifications/presentation/payment-notice-worker.ts#L11)

```ts
this.timer = setInterval(() => {
  if (!this.active)
    this.active = this.run()
      .catch(() => {})
      .finally(() => {
        this.active = undefined;
      });
}, 2000);
```

active предотвращает перекрывающиеся запуски внутри одного процесса. finally освобождает локальный флаг, даже когда запуск завершился ошибкой. OnModuleDestroy останавливает таймер и ожидает активную задачу; enableShutdownHooks подключает lifecycle к завершению приложения.

Локальный флаг не защищает два процесса на разных серверах. Для этого используются DB lease и row/advisory locks. `.catch(() => {})` сохраняет worker живым, но скрывает причину ошибки; перед production полезно добавить безопасные метрики и структурированные сообщения без чувствительных данных.

### Provider scopes

По умолчанию provider — singleton внутри приложения. Request scope создает экземпляры в контексте запроса, transient — при разрешении зависимости для потребителя. Request scope может распространяться по дереву зависимостей и повышать стоимость создания объектов. Здесь singleton services получают userId/correlationId параметрами, поэтому PrismaClient не создается заново на каждый HTTP-запрос. Это разумно для pool соединений. [Injection scopes](https://docs.nestjs.com/fundamentals/injection-scopes).

### Interceptors, filters и AsyncLocalStorage

Эти механизмы полезно изучить дополнительно. Interceptor может обернуть handler измерением latency или нормализацией результата. Exception filter переводит исключение в формат HTTP/RPC. AsyncLocalStorage может хранить correlation context для вложенных вызовов.

В текущем коде gateway часто получает типизированный OrdersResult и явно превращает error в HttpException в [ForwardOrders](../../apps/gateway/src/modules/orders/application/forward-orders.ts). Не следует говорить, что проект уже использует собственный глобальный interceptor/filter/ALS pipeline без соответствующей реализации. Для будущего общего слоя сначала определяют, как один контракт ошибок представляется в HTTP и RMQ.

## Неочевидные решения и их цена

| Решение                                                    | Причина                                        | Какой компромисс нужно объяснить                                   |
| ---------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ |
| Возврат результата вместо throw внутри refresh transaction | Отзыв должен закоммититься                     | Ошибка авторизации появляется после commit                         |
| noAck RPC и manual ack events                              | Разные модели взаимодействия                   | Потерянный RPC response требует безопасного повторения клиентом    |
| Публикация Outbox внутри транзакции                        | Простое удержание выбранной записи до confirm  | Сеть удерживает соединение и lock БД                               |
| Prefetch 1                                                 | Ограниченный объем незавершенной обработки     | Возможен невысокий throughput                                      |
| DB lock по order ID                                        | Согласование cancel, ship и payment event      | Операции одного заказа последовательны                             |
| Снимки items в JSON                                        | Сохранение исторических названий и цен         | Аналитика JSON сложнее нормализованной таблицы order_items         |
| Передача контактов отдельно от событий склада              | Уменьшение распространения персональных данных | Для некоторых read models требуется RPC или собственная проекция   |
| Собственные таймеры workers                                | Небольшая и явная реализация                   | Нужны lease, диагностика, контроль backlog и корректное завершение |

## Как проверить, что материал усвоен

Попробуйте без подсказки объяснить падение процесса после commit перед ack; повтор старого refresh; две покупки последней порции; потерю ответа RPC; оплату старой попытки после retry. Для каждого случая найдите в коде конкретный lock, unique constraint, marker или переход состояния.

Затем возьмите один тест и временно удалите соответствующую защиту в отдельной ветке. Ожидаемый провал теста объяснит назначение строки лучше, чем заученное название паттерна. После упражнения восстановите защиту. Переход к нагрузке, репликации и шардированию описан в [главе масштабирования](scaling.md).
