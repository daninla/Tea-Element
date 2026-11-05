import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const reqCatalog = createRequire(path.join(root, 'apps/catalog-service/package.json'));
const reqOrders = createRequire(path.join(root, 'apps/orders-service/package.json'));
const reqGateway = createRequire(path.join(root, 'apps/gateway/package.json'));
const { PrismaClient: CatalogClient } = reqCatalog('./generated/prisma');
const { PrismaClient: OrdersClient } = reqOrders('./generated/prisma');
const { PrismaStockStore } = reqCatalog('./dist/modules/stock/infrastructure/prisma-stock-store');
const { PrismaOrderStore } = reqOrders('./dist/modules/orders/infrastructure/prisma-order-store');
const { JwtService } = reqGateway('@nestjs/jwt');
const amqp = reqCatalog('amqplib');
const tag = randomUUID().replaceAll('-', '');
const namespace = `stage4-${tag}`;
const names = { catalog: `catalog_stage4_${tag}`, orders: `orders_stage4_${tag}` };
const urls = {
  catalog: `postgresql://catalog:tea_dev_catalog@localhost:5433/${names.catalog}`,
  orders: `postgresql://orders:tea_dev_orders@localhost:5433/${names.orders}`,
};
const secret = randomBytes(48).toString('hex');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  LOG_LEVEL: 'silent',
  JWT_ACCESS_SECRET: secret,
  ORDER_ACCESS_SECRET: secret,
  EVENTS_NAMESPACE: namespace,
  CATALOG_RPC_QUEUE: `${namespace}.catalog.rpc`,
  ORDERS_RPC_QUEUE: `${namespace}.orders.rpc`,
  RABBITMQ_URL: 'amqp://tea:tea_dev@localhost:5672',
  SMTP_URL: 'smtp://localhost:1025',
  WEB_URL: 'http://localhost:3000',
};
const compose = ['compose', '-f', 'infra/docker-compose.yml', 'exec', '-T', 'postgres'];
function command(binary, args, environment = process.env) {
  const r = spawnSync(binary, args, { cwd: root, env: environment, encoding: 'utf8' });
  if (r.status !== 0)
    throw new Error(
      `Integration setup failed: ${binary} ${args.filter((x) => !x.includes('://')).join(' ')}\n${r.stderr.slice(-500)}`,
    );
  return r.stdout;
}
const children = [];
let catalog, orders, connection, channel;
async function waitFor(check, label) {
  for (let i = 0; i < 150; i++) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out: ${label}`);
}
function start(name, port, database) {
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: path.join(root, 'apps', name),
    env: { ...env, PORT: String(port), DATABASE_URL: database ?? urls.orders },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let error = '';
  child.stderr.on('data', (chunk) => {
    error += chunk.toString();
  });
  child.teaService = name;
  children.push(child);
  return waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`${name} exited: ${error.slice(-300)}`);
    try {
      return (await fetch(`http://127.0.0.1:${port}/health`)).ok;
    } catch {
      return false;
    }
  }, name);
}
async function http(route, { method = 'GET', body, key, cookie, status = 200 } = {}) {
  const r = await fetch(`http://127.0.0.1:4300/api/v1${route}`, {
    method,
    headers: {
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
      ...(key ? { 'idempotency-key': key } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  assert.equal(
    r.status,
    status,
    `${method} ${route.split('?')[0]} expected ${status}, got ${r.status} (${data.code ?? ''})`,
  );
  return data;
}
function input(variantId, quantity = 1) {
  return {
    items: [{ variantId, quantity }],
    firstName: 'Тест',
    lastName: 'Покупець',
    phone: '+380501234567',
    email: `test-${tag}@example.test`,
    delivery: { method: 'NOVA_POSHTA_BRANCH', city: 'Київ', address: 'Відділення 1' },
    paymentMethod: 'CASH_ON_DELIVERY',
    marketingConsent: false,
    acceptTerms: true,
  };
}
function event(name, orderId, extra = {}) {
  return {
    eventId: randomUUID(),
    name,
    version: name === 'OrderCreated' ? 2 : 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    payload: { orderId, ...extra },
  };
}
async function publish(e, key) {
  await new Promise((resolve, reject) =>
    channel.publish(
      `${namespace}.events`,
      key,
      Buffer.from(JSON.stringify(e)),
      { persistent: true },
      (error) => (error ? reject(error) : resolve()),
    ),
  );
}
async function reserved(id, grams) {
  return waitFor(async () => {
    const row = await catalog.inventory.findUniqueOrThrow({ where: { productId: id } });
    return row.reservedGrams === grams;
  }, 'inventory convergence');
}
async function statusOf(created, status) {
  return waitFor(async () => {
    const row = await orders.order.findUniqueOrThrow({ where: { id: created.order.id } });
    return row.status === status ? row : false;
  }, `order ${status}`);
}
try {
  for (const [service, name] of Object.entries(names)) {
    command('docker', [...compose, 'createdb', '-U', 'tea_bootstrap', '-O', service, name]);
    command(
      'pnpm',
      ['--filter', `@tea/${service}-service`, 'exec', 'prisma', 'migrate', 'deploy'],
      { ...env, DATABASE_URL: urls[service] },
    );
  }
  command('pnpm', ['--filter', '@tea/catalog-service', 'db:seed'], {
    ...env,
    DATABASE_URL: urls.catalog,
  });
  command('pnpm', ['--filter', '@tea/catalog-service', 'db:seed'], {
    ...env,
    DATABASE_URL: urls.catalog,
  });
  catalog = new CatalogClient({ datasources: { db: { url: urls.catalog } } });
  orders = new OrdersClient({ datasources: { db: { url: urls.orders } } });
  await start('catalog-service', 4302, urls.catalog);
  await start('orders-service', 4303, urls.orders);
  await start('gateway', 4300);
  connection = await amqp.connect(env.RABBITMQ_URL);
  channel = await connection.createConfirmChannel();
  const product = await catalog.product.findUniqueOrThrow({
    where: { slug: 'tie-guan-yin' },
    include: { variants: { orderBy: { weightGrams: 'asc' } }, inventory: true },
  });
  const variant = product.variants[0];
  const body = input(variant.id);
  const key = randomUUID();
  const quote = await http('/cart/quote', { method: 'POST', body: { items: body.items } });
  assert.equal(quote.total, 9900);
  assert.equal(quote.discount, 1100);
  await http('/orders/guest', { method: 'POST', body: { ...body, total: 1 }, key, status: 400 });
  await http('/orders/guest', {
    method: 'POST',
    body: { ...body, acceptTerms: false },
    key,
    status: 400,
  });
  await http('/orders/guest', { method: 'POST', body, key: 'invalid', status: 400 });
  const [created, replay] = await Promise.all([
    http('/orders/guest', { method: 'POST', body, key, status: 201 }),
    http('/orders/guest', { method: 'POST', body, key, status: 201 }),
  ]);
  assert.equal(created.order.id, replay.order.id);
  assert.equal(created.accessToken, replay.accessToken);
  assert.equal(created.order.total, 9900);
  assert.equal(await orders.order.count(), 1);
  const stored = await orders.order.findUniqueOrThrow({ where: { id: created.order.id } });
  assert.equal(stored.userId, null);
  assert.equal(stored.marketingConsentAt, null);
  assert.notEqual(stored.accessTokenHash, created.accessToken);
  assert.equal(stored.accessTokenHash.length, 64);
  await http('/orders/guest', {
    method: 'POST',
    body: { ...body, comment: 'changed' },
    key,
    status: 409,
  });
  await statusOf(created, 'CONFIRMED');
  await reserved(product.id, 25);
  await http(`/orders/${created.order.number}`, { status: 404 });
  await http(`/orders/${created.order.number}?token=${randomBytes(32).toString('base64url')}`, {
    status: 404,
  });
  const privateOrder = await http(`/orders/${created.order.number}?token=${created.accessToken}`);
  assert.equal(privateOrder.status, 'CONFIRMED');
  await http(`/orders/${created.order.number}?token=${created.accessToken}`, {
    cookie: 'tea_access=expired',
  });
  await http('/cart', { cookie: 'tea_access=expired', status: 401 });
  assert.equal(privateOrder.items[0].unitPrice, 9900);
  const owner = randomUUID();
  const other = randomUUID();
  const jwt = new JwtService();
  async function cookie(id, role = 'CUSTOMER') {
    return `tea_access=${await jwt.signAsync({ sub: id, email: 'customer@example.test', role }, { secret, algorithm: 'HS256', issuer: 'tea-auth', audience: 'tea-gateway', expiresIn: '15m' })}`;
  }
  await http(`/orders/${created.order.number}`, { cookie: await cookie(owner), status: 404 });
  const owned = await http('/orders', {
    method: 'POST',
    body,
    key: randomUUID(),
    cookie: await cookie(owner),
    status: 201,
  });
  await statusOf(owned, 'CONFIRMED');
  await reserved(product.id, 50);
  await http(`/orders/${owned.order.number}`, { cookie: await cookie(owner) });
  await http(`/orders/${owned.order.number}`, { cookie: await cookie(other), status: 404 });
  await http('/cart', { status: 401 });
  await http('/cart', { method: 'PUT', body: { items: body.items }, cookie: await cookie(owner) });
  const mergeKey = randomUUID();
  const merged = await http('/cart/merge', {
    method: 'POST',
    key: mergeKey,
    body: { items: body.items },
    cookie: await cookie(owner),
  });
  assert.equal(merged[0].quantity, 2);
  const repeatedMerge = await http('/cart/merge', {
    method: 'POST',
    key: mergeKey,
    body: { items: body.items },
    cookie: await cookie(owner),
  });
  assert.equal(repeatedMerge[0].quantity, 2);
  assert.deepEqual(await http('/cart', { cookie: await cookie(other) }), []);
  // Duplicate event IDs and different IDs for the same order cannot reserve twice.
  const creation = (
    await orders.outbox.findFirstOrThrow({
      where: {
        eventName: 'OrderCreated',
        payload: { path: ['payload', 'orderId'], equals: created.order.id },
      },
    })
  ).payload;
  await publish(creation, 'orders.order_created.v2');
  await publish({ ...creation, eventId: randomUUID() }, 'orders.order_created.v2');
  await new Promise((r) => setTimeout(r, 500));
  await reserved(product.id, 50);
  await http(`/orders/${created.order.number}/cancel?token=${created.accessToken}`, {
    method: 'POST',
    body: {},
  });
  await reserved(product.id, 25);
  await http(`/orders/${created.order.number}/cancel?token=${created.accessToken}`, {
    method: 'POST',
    body: {},
  });
  await publish({ ...creation, eventId: randomUUID() }, 'orders.order_created.v2');
  await new Promise((r) => setTimeout(r, 300));
  await reserved(product.id, 25);
  const tombstone = randomUUID();
  await publish(
    event('OrderCancelled', tombstone, { reason: 'CUSTOMER' }),
    'orders.order_cancelled',
  );
  await waitFor(
    () => catalog.stockReservation.findUnique({ where: { orderId: tombstone } }),
    'cancellation tombstone',
  );
  await publish(
    event('OrderCreated', tombstone, { items: creation.payload.items }),
    'orders.order_created.v2',
  );
  await new Promise((r) => setTimeout(r, 300));
  await reserved(product.id, 25);
  // Reservation rollback when Outbox insertion fails: neither grams nor processed marker can commit.
  const failedEvent = event('OrderCreated', randomUUID(), { items: creation.payload.items });
  const failing = catalog.$extends({
    query: {
      outbox: {
        create() {
          throw new Error('Injected outbox failure');
        },
      },
    },
  });
  await assert.rejects(() => new PrismaStockStore(failing).apply(failedEvent));
  assert.equal(await catalog.processedEvent.count({ where: { eventId: failedEvent.eventId } }), 0);
  assert.equal(
    await catalog.stockReservation.count({ where: { orderId: failedEvent.payload.orderId } }),
    0,
  );
  await reserved(product.id, 25);
  // Two competing orders are created against the same quote before either event is released.
  const gaba = await catalog.product.findUniqueOrThrow({
    where: { slug: 'gaba-oolong' },
    include: { variants: { orderBy: { weightGrams: 'asc' } } },
  });
  const [g1, g2] = await Promise.all([
    http('/orders/guest', {
      method: 'POST',
      body: input(gaba.variants[0].id),
      key: randomUUID(),
      status: 201,
    }),
    http('/orders/guest', {
      method: 'POST',
      body: input(gaba.variants[0].id),
      key: randomUUID(),
      status: 201,
    }),
  ]);
  await waitFor(async () => {
    const rows = await orders.order.findMany({ where: { id: { in: [g1.order.id, g2.order.id] } } });
    return rows.every((x) => x.status !== 'PENDING') ? rows : false;
  }, 'concurrent reservations').then((rows) =>
    assert.deepEqual(rows.map((x) => x.status).sort(), ['CONFIRMED', 'REJECTED']),
  );
  await reserved(gaba.id, 25);
  // Timeout cancels a pending order and a late success must never revive it.
  const pendingId = randomUUID();
  const localStore = new PrismaOrderStore(orders);
  process.env.ORDER_ACCESS_SECRET = secret;
  const pending = await localStore.create(
    body,
    { idempotencyKey: pendingId, correlationId: randomUUID() },
    quote,
  );
  await orders.order.update({
    where: { id: pending.order.id },
    data: { reservationExpiresAt: new Date(0) },
  });
  await localStore.expire();
  await statusOf(pending, 'CANCELLED');
  await publish(event('StockReserved', pending.order.id), 'catalog.stock_reserved');
  await new Promise((r) => setTimeout(r, 500));
  await statusOf(pending, 'CANCELLED');
  await waitFor(async () => {
    const row = await orders.order.findUniqueOrThrow({ where: { id: created.order.id } });
    return row.receiptSentAt;
  }, 'transactional email');
  const mail = await (await fetch('http://127.0.0.1:8025/api/v1/messages')).json();
  assert.ok(mail.messages.some((x) => x.Subject.includes(created.order.number)));

  const gaiwan = await catalog.product.findUniqueOrThrow({
    where: { slug: 'porcelain-gaiwan' },
    include: { variants: true },
  });
  const tongs = await catalog.product.findUniqueOrThrow({
    where: { slug: 'bamboo-tea-tongs' },
    include: { variants: true },
  });
  async function pieces(productId, count) {
    await waitFor(async () => {
      const stock = await catalog.inventory.findUniqueOrThrow({ where: { productId } });
      assert.equal(stock.reservedGrams, 0);
      return stock.reservedPieces === count;
    }, 'piece inventory convergence');
  }
  const mixedInput = {
    ...body,
    items: [
      { variantId: variant.id, quantity: 2 },
      { variantId: gaiwan.variants[0].id, quantity: 1 },
    ],
  };
  const mixed = await http('/orders/guest', {
    method: 'POST',
    body: mixedInput,
    key: randomUUID(),
    status: 201,
  });
  assert.equal(mixed.order.total, 108800);
  assert.equal(mixed.order.items.find((x) => x.productId === gaiwan.id).weightGrams, null);
  await statusOf(mixed, 'CONFIRMED');
  await reserved(product.id, 75);
  await pieces(gaiwan.id, 1);
  const mixedEvent = (
    await orders.outbox.findFirstOrThrow({
      where: {
        eventName: 'OrderCreated',
        payload: { path: ['payload', 'orderId'], equals: mixed.order.id },
      },
    })
  ).payload;
  assert.equal(mixedEvent.version, 2);
  assert.ok(mixedEvent.payload.items.some((x) => x.stockUnit === 'PIECE' && x.stockQuantity === 1));
  await publish(mixedEvent, 'orders.order_created.v2');
  await http(`/orders/${mixed.order.number}/cancel?token=${mixed.accessToken}`, {
    method: 'POST',
    body: {},
  });
  await reserved(product.id, 25);
  await pieces(gaiwan.id, 0);
  const mixedQuote = await http('/cart/quote', {
    method: 'POST',
    body: {
      items: [
        { variantId: variant.id, quantity: 1 },
        { variantId: tongs.variants[0].id, quantity: 1 },
      ],
    },
  });
  const orderProcess = children.find((child) => child.teaService === 'orders-service');
  let contestants;
  orderProcess.kill('SIGSTOP');
  try {
    contestants = await Promise.all(
      [1, 2].map(() =>
        localStore.create(
          {
            ...body,
            items: mixedQuote.items.map(({ variantId, quantity }) => ({ variantId, quantity })),
          },
          { idempotencyKey: randomUUID(), correlationId: randomUUID() },
          mixedQuote,
        ),
      ),
    );
  } finally {
    orderProcess.kill('SIGCONT');
  }
  const rows = await waitFor(async () => {
    const rows = await orders.order.findMany({
      where: { id: { in: contestants.map((x) => x.order.id) } },
    });
    return rows.every((x) => x.status !== 'PENDING') ? rows : false;
  }, 'last equipment piece');
  assert.deepEqual(rows.map((x) => x.status).sort(), ['CONFIRMED', 'REJECTED']);
  await pieces(tongs.id, 1);
  await reserved(product.id, 50);
  const winner = contestants.find(
    (x) => rows.find((row) => row.id === x.order.id).status === 'CONFIRMED',
  );
  await http(`/orders/${winner.order.number}/cancel?token=${winner.accessToken}`, {
    method: 'POST',
    body: {},
  });
  await pieces(tongs.id, 0);
  await reserved(product.id, 25);
  // A pending legacy v1 Outbox message and old gram-shaped reservation still work after migration.
  let legacy;
  orderProcess.kill('SIGSTOP');
  try {
    legacy = await localStore.create(
      body,
      { idempotencyKey: randomUUID(), correlationId: randomUUID() },
      quote,
    );
    const outbox = await orders.outbox.findFirstOrThrow({
      where: {
        eventName: 'OrderCreated',
        payload: { path: ['payload', 'orderId'], equals: legacy.order.id },
      },
    });
    const v1 = {
      ...outbox.payload,
      version: 1,
      payload: {
        orderId: legacy.order.id,
        items: [{ productId: product.id, variantId: variant.id, weightGrams: 25, quantity: 1 }],
      },
    };
    await orders.outbox.update({ where: { id: outbox.id }, data: { payload: v1 } });
  } finally {
    orderProcess.kill('SIGCONT');
  }
  await statusOf(legacy, 'CONFIRMED');
  await reserved(product.id, 50);
  await catalog.stockReservation.update({
    where: { orderId: legacy.order.id },
    data: { items: [{ productId: product.id, grams: 25 }] },
  });
  await http(`/orders/${legacy.order.number}/cancel?token=${legacy.accessToken}`, {
    method: 'POST',
    body: {},
  });
  await reserved(product.id, 25);
  // Verification is a real broker event, with a proof-time cutoff and idempotent ownership.
  const accountUser = randomUUID();
  const beforeProof = await http('/orders?page=1', { cookie: await cookie(accountUser) });
  assert.equal(beforeProof.total, 0);
  const proofEvent = {
    eventId: randomUUID(),
    name: 'UserEmailVerified',
    version: 1,
    occurredAt: new Date().toISOString(),
    correlationId: randomUUID(),
    payload: { userId: accountUser, email: body.email },
  };
  await publish(proofEvent, 'auth.user_email_verified');
  await publish(proofEvent, 'auth.user_email_verified');
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: created.order.id } })).userId ===
      accountUser,
    'verified guest linking',
  );
  await http(`/orders/${created.order.number}`, { cookie: await cookie(accountUser) });
  await http(`/orders/${created.order.number}`, { cookie: await cookie(other), status: 404 });
  await http(`/orders/${created.order.number}?token=${created.accessToken}`);
  const history = await http('/orders?page=1', { cookie: await cookie(accountUser) });
  assert.ok(history.items.some((x) => x.id === created.order.id));
  assert.ok(
    history.items.every((x) => x.accessToken === undefined && x.accessTokenHash === undefined),
  );
  assert.ok(history.items.length <= 10);
  await http('/orders?page=0', { cookie: await cookie(accountUser), status: 400 });
  await http('/orders?page=1', { status: 401 });
  const future = await localStore.create(
    body,
    { idempotencyKey: randomUUID(), correlationId: randomUUID() },
    quote,
  );
  await localStore.reconcileVerified();
  assert.equal(
    (await orders.order.findUniqueOrThrow({ where: { id: future.order.id } })).userId,
    null,
  );
  await localStore.linkVerified({
    ...proofEvent,
    eventId: randomUUID(),
    occurredAt: new Date().toISOString(),
  });
  assert.equal(
    (await orders.order.findUniqueOrThrow({ where: { id: future.order.id } })).userId,
    accountUser,
  );
  // Reconciliation covers an order whose commit arrived after the verification event.
  const late = await localStore.create(
    body,
    { idempotencyKey: randomUUID(), correlationId: randomUUID() },
    quote,
  );
  await orders.order.update({
    where: { id: late.order.id },
    data: { createdAt: new Date(Date.parse(proofEvent.occurredAt) - 1000) },
  });
  await localStore.reconcileVerified();
  assert.equal(
    (await orders.order.findUniqueOrThrow({ where: { id: late.order.id } })).userId,
    accountUser,
  );
  const wrongLookup = await http('/orders/lookup', {
    method: 'POST',
    body: { number: created.order.number, email: 'wrong@example.test' },
  });
  const missingLookup = await http('/orders/lookup', {
    method: 'POST',
    body: { number: 'TE-' + 'F'.repeat(32), email: body.email },
  });
  const correctLookup = await http('/orders/lookup', {
    method: 'POST',
    body: { number: created.order.number, email: body.email },
  });
  assert.deepEqual(wrongLookup, missingLookup);
  assert.deepEqual(correctLookup, missingLookup);
  assert.ok(
    (await orders.order.findUniqueOrThrow({ where: { id: created.order.id } })).lookupRequestedAt,
  );
  // Admin reads use a separate RBAC boundary; guest/order bearer access remains unchanged.
  const adminCookie = await cookie(randomUUID(), 'ADMIN');
  await http('/admin/orders', { status: 401 });
  await http('/admin/orders', { cookie: await cookie(other), status: 403 });
  await http(`/admin/orders/${created.order.id}`, { cookie: await cookie(other), status: 403 });
  const adminDetail = await http(`/admin/orders/${created.order.id}`, { cookie: adminCookie });
  assert.equal(adminDetail.email, body.email);
  for (const field of [
    'accessToken',
    'accessTokenHash',
    'tokenNonce',
    'idempotencyHash',
    'requestHash',
  ])
    assert.equal(adminDetail[field], undefined);
  await http('/admin/orders/not-a-uuid', { cookie: adminCookie, status: 400 });
  await http(`/admin/orders/${randomUUID()}`, { cookie: adminCookie, status: 404 });
  const allAdmin = await http('/admin/orders', { cookie: adminCookie });
  assert.equal(allAdmin.total, await orders.order.count());
  assert.ok(allAdmin.items.length <= 20);
  await http('/admin/orders?page=10001', { cookie: adminCookie, status: 400 });
  await http('/admin/orders?userId=' + other, { cookie: adminCookie, status: 400 });
  await http('/admin/orders?from=2026-11-05T00:00:00Z&to=2026-11-04T00:00:00Z', {
    cookie: adminCookie,
    status: 400,
  });
  const percent = await http('/admin/orders?q=%25', { cookie: adminCookie });
  assert.equal(percent.total, 0);
  // Explicit read fixtures in the disposable DB exercise deterministic pagination and literal search.
  const prefix = 'admin_' + tag;
  const fixtures = Array.from({ length: 23 }, () => ({
    ...stored,
    id: randomUUID(),
    number: 'TE-' + randomUUID().replaceAll('-', '').toUpperCase(),
    userId: null,
    status: 'CANCELLED',
    email: prefix + '%_@example.test',
    idempotencyHash: randomBytes(32).toString('hex'),
    createdAt: new Date('2020-01-02T12:00:00Z'),
    receiptSentAt: new Date(),
  }));
  await orders.order.createMany({ data: fixtures });
  const query =
    'q=' +
    encodeURIComponent(prefix + '%_') +
    '&customerType=GUEST&status=CANCELLED&paymentMethod=CASH_ON_DELIVERY&from=2020-01-02T00:00:00Z&to=2020-01-03T00:00:00Z';
  const firstPage = await http('/admin/orders?' + query, { cookie: adminCookie });
  const secondPage = await http('/admin/orders?' + query + '&page=2', { cookie: adminCookie });
  assert.equal(firstPage.total, 23);
  assert.equal(firstPage.items.length, 20);
  assert.equal(secondPage.items.length, 3);
  assert.equal(new Set([...firstPage.items, ...secondPage.items].map((x) => x.id)).size, 23);
  const accountsOnly = await http('/admin/orders?customerType=ACCOUNT', { cookie: adminCookie });
  assert.ok(accountsOnly.items.every((x) => x.userId !== null));
  await orders.order.deleteMany({ where: { id: { in: fixtures.map((x) => x.id) } } });
  // Permanent malformed event is retried then quarantined instead of blocking a queue.
  await publish({ bad: true }, 'orders.order_created.v2');
  await waitFor(async () => {
    const q = await channel.checkQueue(`${namespace}.catalog.order_created_v2.dlq`);
    return q.messageCount > 0;
  }, 'dead letter');
  console.log(
    'Orders integration passed: clean migrations, repeatable seed, fresh prices, validation, concurrent idempotency, private guest/owner access, server carts, confirmed reservation, duplicate/reordered events, rollback, no oversell, rejection, cancellation, timeout, SMTP receipt, mixed gram/piece carts, atomic last-piece competition, legacy v1 compatibility, verified guest linking, private history, proof cutoff/reconciliation, neutral lookup, ADMIN list/detail role checks, secret exclusion, literal filters, stable pagination and DLQ.',
  );
} finally {
  for (const child of children)
    if (child.exitCode === null) {
      child.kill('SIGCONT');
      child.kill('SIGTERM');
    }
  await Promise.all(
    children.map(async (child) => {
      if (child.exitCode !== null) return;
      await Promise.race([once(child, 'exit'), new Promise((r) => setTimeout(r, 5000))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }),
  );
  if (channel) {
    for (const [base] of reqOrders('@tea/contracts').CHECKOUT_SUBSCRIPTIONS)
      for (const suffix of ['', '.retry', '.dlq'])
        await channel.deleteQueue(`${namespace}.${base}${suffix}`).catch(() => {});
    for (const q of [env.CATALOG_RPC_QUEUE, env.ORDERS_RPC_QUEUE])
      await channel.deleteQueue(q).catch(() => {});
    for (const x of [`${namespace}.events`, `${namespace}.events.dlx`])
      await channel.deleteExchange(x).catch(() => {});
    await channel.close().catch(() => {});
  }
  await connection?.close();
  await catalog?.$disconnect();
  await orders?.$disconnect();
  for (const name of Object.values(names))
    command('docker', [
      ...compose,
      'dropdb',
      '--if-exists',
      '--force',
      '-U',
      'tea_bootstrap',
      name,
    ]);
}
