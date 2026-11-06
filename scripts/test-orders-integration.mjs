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
  await http('/admin/dashboard', { status: 401 });
  await http('/admin/dashboard', { cookie: await cookie(other), status: 403 });
  await http('/admin/dashboard?days=2', { cookie: adminCookie, status: 400 });
  await http('/admin/dashboard?days=7&userId=' + other, { cookie: adminCookie, status: 400 });
  const liveReport = await http('/admin/dashboard?days=7', { cookie: adminCookie });
  assert.equal(liveReport.series.length, 7);
  assert.equal(liveReport.days, 7);
  assert.ok(liveReport.asOf && liveReport.from);
  for (const field of ['email', 'phone', 'accessToken', 'accessTokenHash', 'orders'])
    assert.equal(liveReport[field], undefined);
  const { PrismaAdminDashboardStore } = reqOrders(
    './dist/modules/administration/infrastructure/prisma-admin-dashboard-store',
  );
  const dashboard = new PrismaAdminDashboardStore(orders),
    asOf = new Date('2024-10-27T12:00:00Z');
  const reportIds = [];
  try {
    const specs = [
      {
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_CARD',
        paymentStatus: 'PAID',
        total: 10100,
        userId: accountUser,
        createdAt: '2024-10-26T21:00:00Z',
        at: '2024-10-27T00:00:00Z',
        weight: 25,
        price: 5050,
      },
      {
        status: 'COMPLETED',
        paymentMethod: 'CASH_ON_DELIVERY',
        paymentStatus: 'PAID',
        total: 20200,
        userId: null,
        createdAt: '2024-10-26T20:59:59Z',
        at: '2024-10-27T10:00:00Z',
        weight: null,
        price: 10100,
      },
      {
        status: 'CANCELLED',
        paymentMethod: 'ONLINE_CARD',
        paymentStatus: 'UNPAID',
        total: 30300,
        userId: null,
        createdAt: '2024-10-27T11:00:00Z',
        at: null,
        weight: 25,
        price: 15150,
      },
      {
        status: 'PAID',
        paymentMethod: 'ONLINE_CARD',
        paymentStatus: 'PAID',
        total: 30300,
        userId: null,
        createdAt: '2024-10-27T11:30:00Z',
        at: null,
        weight: 25,
        price: 15150,
      },
      {
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_CARD',
        paymentStatus: 'REFUNDED',
        total: 30300,
        userId: null,
        createdAt: '2024-10-28T11:00:00Z',
        at: '2024-10-27T11:00:00Z',
        weight: 25,
        price: 15150,
      },
      {
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_CARD',
        paymentStatus: 'PAID',
        total: 99990,
        userId: null,
        createdAt: '2024-09-20T11:00:00Z',
        at: '2024-10-26T19:00:00Z',
        weight: 25,
        price: 49995,
      },
      {
        status: 'COMPLETED',
        paymentMethod: 'ONLINE_CARD',
        paymentStatus: 'PAID',
        total: 30300,
        userId: null,
        createdAt: '2024-10-28T11:00:00Z',
        at: '2024-10-27T13:00:00Z',
        weight: 25,
        price: 15150,
      },
    ];
    const teaReportId = randomUUID(),
      pieceReportId = randomUUID();
    for (const x of specs) {
      const id = randomUUID();
      reportIds.push(id);
      await orders.order.create({
        data: {
          ...stored,
          id,
          number: 'TE-' + randomUUID().replaceAll('-', '').toUpperCase(),
          status: x.status,
          paymentMethod: x.paymentMethod,
          paymentStatus: x.paymentStatus,
          userId: x.userId,
          subtotal: x.total,
          discount: 0,
          total: x.total,
          createdAt: new Date(x.createdAt),
          receiptSentAt: new Date(),
          idempotencyHash: randomBytes(32).toString('hex'),
          items: [
            {
              productId: x.weight === null ? pieceReportId : teaReportId,
              variantId: randomUUID(),
              name: x.weight === null ? 'Report piece' : 'Report tea',
              slug: 'report',
              weightGrams: x.weight,
              quantity: 2,
              unitPrice: x.price,
              originalPrice: x.price,
            },
          ],
          ...(x.at
            ? { history: { create: { status: 'COMPLETED', createdAt: new Date(x.at) } } }
            : {}),
        },
      });
    }
    await orders.orderStatusHistory.create({
      data: {
        orderId: reportIds[5],
        status: 'COMPLETED',
        createdAt: new Date('2024-10-27T05:00:00Z'),
      },
    });
    const report = await dashboard.read(1, asOf);
    assert.equal(report.from, '2024-10-26T21:00:00.000Z');
    assert.equal(report.createdOrders, 3);
    assert.equal(report.unlinkedOrders, 2);
    assert.equal(report.completedOrders, 2);
    assert.equal(report.onlineRevenue, 10100);
    assert.equal(report.codRevenue, 20200);
    assert.equal(report.averageOrder, 15150);
    assert.equal(report.series.length, 1);
    assert.equal(report.series[0].day, '2024-10-27');
    assert.deepEqual(
      report.topProducts.map((x) => [x.productId, x.unit, x.quantity, x.revenue]),
      [
        [pieceReportId, 'PIECE', 2, 20200],
        [teaReportId, 'GRAM', 50, 10100],
      ],
    );
    const spring = await dashboard.read(1, new Date('2024-03-31T12:00:00Z'));
    assert.equal(spring.from, '2024-03-30T22:00:00.000Z');
    assert.equal(spring.completedOrders, 0);
    assert.equal(spring.averageOrder, 0);
    assert.deepEqual(spring.topProducts, []);
    const month = await dashboard.read(30, asOf);
    assert.equal(month.series.length, 30);
    assert.equal(month.completedOrders, 3);
    assert.equal(month.onlineRevenue, 110090);
  } finally {
    await orders.order.deleteMany({ where: { id: { in: reportIds } } });
  }
  console.log(
    'Dashboard integration passed: ADMIN/strict input, current and historic period bounds, Kyiv DST changes, completion-time recognition, COD/online split, refunded/unfinished/future exclusions, duplicate history, guest linking semantics, gram/piece top sellers and empty days.',
  );
  await http('/admin/customers/guests', { status: 401 });
  await http('/admin/customers/guests', { cookie: await cookie(other), status: 403 });
  await http('/admin/customers/history?kind=ACCOUNT&id=' + accountUser, {
    cookie: await cookie(other),
    status: 403,
  });
  await http(
    '/admin/customers/history?kind=ACCOUNT&id=' +
      accountUser +
      '&email=' +
      encodeURIComponent(body.email),
    { cookie: adminCookie, status: 400 },
  );
  await http('/admin/customers/guests?page=0', { cookie: adminCookie, status: 400 });
  await http('/admin/customers/history?kind=GUEST&email=invalid', {
    cookie: adminCookie,
    status: 400,
  });
  await http('/admin/customers/history?kind=GUEST&email=' + randomUUID() + '%40example.test', {
    cookie: adminCookie,
    status: 404,
  });
  const contactTag = 'contacts-' + randomUUID() + '%_',
    contactIds = [];
  try {
    const contactRows = Array.from({ length: 23 }, (_, i) => ({
      ...stored,
      id: randomUUID(),
      number: 'TE-' + randomUUID().replaceAll('-', '').toUpperCase(),
      userId: null,
      status: 'CANCELLED',
      email: 'contact-' + i + '-' + tag + '@example.test',
      firstName: 'Contact',
      lastName: contactTag,
      idempotencyHash: randomBytes(32).toString('hex'),
      createdAt: new Date('2020-01-01T12:00:00Z'),
      receiptSentAt: new Date(),
    }));
    contactIds.push(...contactRows.map((x) => x.id));
    await orders.order.createMany({ data: contactRows });
    const paidId = randomUUID();
    contactIds.push(paidId);
    await orders.order.create({
      data: {
        ...contactRows[0],
        id: paidId,
        number: 'TE-' + randomUUID().replaceAll('-', '').toUpperCase(),
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        firstName: 'Latest contact',
        subtotal: 19900,
        discount: 0,
        total: 19900,
        items: [
          {
            ...stored.items[0],
            quantity: 2,
            weightGrams: 25,
            unitPrice: 9950,
            originalPrice: 9950,
          },
        ],
        idempotencyHash: randomBytes(32).toString('hex'),
        createdAt: new Date('2021-01-01T12:00:00Z'),
      },
    });
    const c1 = await http('/admin/customers/guests?q=' + encodeURIComponent(contactTag), {
        cookie: adminCookie,
      }),
      c2 = await http('/admin/customers/guests?q=' + encodeURIComponent(contactTag) + '&page=2', {
        cookie: adminCookie,
      });
    assert.equal(c1.total, 23);
    assert.equal(c1.items.length, 20);
    assert.equal(c2.items.length, 3);
    assert.equal(new Set([...c1.items, ...c2.items].map((x) => x.email)).size, 23);
    assert.equal(c1.items[0].firstName, 'Latest contact');
    assert.equal(c1.items[0].orderCount, 2);
    assert.equal(c1.items[0].completedTotal, 19900);
    const guestUrl =
      '/admin/customers/history?kind=GUEST&email=' +
      encodeURIComponent(contactRows[0].email.toUpperCase());
    const guestHistory = await http(guestUrl, { cookie: adminCookie });
    assert.equal(guestHistory.summary.orderCount, 2);
    assert.equal(guestHistory.summary.completedCount, 1);
    assert.equal(guestHistory.summary.completedTotal, 19900);
    assert.equal(guestHistory.summary.contact.firstName, 'Latest contact');
    assert.equal(guestHistory.products[0].unit, 'GRAM');
    assert.equal(guestHistory.products[0].quantity, 50);
    assert.equal(guestHistory.products[0].revenue, 19900);
    for (const o of guestHistory.orders.items)
      for (const key of [
        'accessToken',
        'accessTokenHash',
        'tokenNonce',
        'idempotencyHash',
        'requestHash',
      ])
        assert.equal(o[key], undefined);
    const outOfRange = await http(guestUrl + '&page=999', { cookie: adminCookie });
    assert.equal(outOfRange.orders.items.length, 0);
    assert.equal(outOfRange.summary.contact.firstName, 'Latest contact');
    assert.equal(outOfRange.orders.total, 2);
    await orders.order.update({ where: { id: paidId }, data: { paymentStatus: 'REFUNDED' } });
    const refunded = await http(guestUrl, { cookie: adminCookie });
    assert.equal(refunded.summary.completedTotal, 0);
    assert.deepEqual(refunded.products, []);
    const sameEmailGuest = randomUUID();
    contactIds.push(sameEmailGuest);
    await orders.order.create({
      data: {
        ...contactRows[0],
        id: sameEmailGuest,
        number: 'TE-' + randomUUID().replaceAll('-', '').toUpperCase(),
        email: body.email,
        createdAt: new Date(),
        idempotencyHash: randomBytes(32).toString('hex'),
      },
    });
    const ownCustomer = await http('/admin/customers/history?kind=ACCOUNT&id=' + accountUser, {
      cookie: adminCookie,
    });
    assert.equal(
      ownCustomer.summary.orderCount,
      await orders.order.count({ where: { userId: accountUser } }),
    );
    assert.ok(ownCustomer.orders.items.every((x) => x.userId === accountUser));
    assert.ok(ownCustomer.orders.items.every((x) => x.id !== sameEmailGuest));
    const sameEmailGroup = await http(
      '/admin/customers/history?kind=GUEST&email=' + encodeURIComponent(body.email),
      { cookie: adminCookie },
    );
    assert.ok(sameEmailGroup.orders.items.every((x) => x.userId === null));
    assert.ok(sameEmailGroup.orders.items.some((x) => x.id === sameEmailGuest));
    assert.ok(sameEmailGroup.orders.items.every((x) => x.id !== created.order.id));
    const noOrders = await http('/admin/customers/history?kind=ACCOUNT&id=' + randomUUID(), {
      cookie: adminCookie,
    });
    assert.equal(noOrders.summary.orderCount, 0);
    assert.equal(noOrders.summary.contact, null);
    assert.deepEqual(noOrders.products, []);
    console.log(
      'Customer history integration passed: ADMIN-only guest groups, stable/literal pagination, latest contacts, completed/refunded totals, gram purchase snapshots, secret exclusion and strict user_id versus unlinked email history without automatic linking.',
    );
  } finally {
    await orders.order.deleteMany({ where: { id: { in: contactIds } } });
  }
  // Fulfillment: optimistic/idempotent admin commands and an acknowledged inventory deduction.
  const fulfillment = await http('/orders/guest', {
    method: 'POST',
    body: mixedInput,
    key: randomUUID(),
    status: 201,
  });
  await statusOf(fulfillment, 'CONFIRMED');
  const { PrismaAdminOrdersStore } = reqOrders(
    './dist/modules/administration/infrastructure/prisma-admin-orders-store',
  );
  const adminStore = new PrismaAdminOrdersStore(orders);
  const actor = randomUUID();
  const shipCommand = {
    id: fulfillment.order.id,
    status: 'SHIPPED',
    expectedStatus: 'CONFIRMED',
    reason: 'Demonstration shipment',
    key: randomUUID(),
  };
  const brokenAdmin = new PrismaAdminOrdersStore(
    orders.$extends({
      query: {
        outbox: {
          create() {
            throw new Error('injected outbox failure');
          },
        },
      },
    }),
  );
  await assert.rejects(() => brokenAdmin.transition(shipCommand, actor, randomUUID()));
  assert.equal(
    (await orders.order.findUniqueOrThrow({ where: { id: fulfillment.order.id } })).status,
    'CONFIRMED',
  );
  assert.equal(
    await orders.adminOrderCommand.count({ where: { orderId: fulfillment.order.id } }),
    0,
  );
  const beforeTea = await catalog.inventory.findUniqueOrThrow({ where: { productId: product.id } });
  const beforePiece = await catalog.inventory.findUniqueOrThrow({
    where: { productId: gaiwan.id },
  });
  const catalogProcess = children.find((x) => x.teaService === 'catalog-service');
  catalogProcess.kill('SIGSTOP');
  const changePath = `/admin/orders/${fulfillment.order.id}/status`;
  const shipBody = { status: 'SHIPPED', expectedStatus: 'CONFIRMED', reason: shipCommand.reason };
  try {
    await http(changePath, { method: 'PATCH', body: shipBody, key: shipCommand.key, status: 401 });
    await http(changePath, {
      method: 'PATCH',
      body: shipBody,
      key: shipCommand.key,
      cookie: await cookie(other),
      status: 403,
    });
    await http(changePath, {
      method: 'PATCH',
      body: { ...shipBody, actorId: other },
      key: shipCommand.key,
      cookie: adminCookie,
      status: 400,
    });
    const [a, b] = await Promise.all([
      http(changePath, {
        method: 'PATCH',
        body: shipBody,
        key: shipCommand.key,
        cookie: adminCookie,
      }),
      http(changePath, {
        method: 'PATCH',
        body: shipBody,
        key: shipCommand.key,
        cookie: adminCookie,
      }),
    ]);
    assert.equal(a.status, 'SHIPPED');
    assert.equal(b.status, 'SHIPPED');
    assert.equal(a.actions.length, 1);
    await http(changePath, {
      method: 'PATCH',
      body: { status: 'COMPLETED', expectedStatus: 'SHIPPED', reason: 'Too early' },
      key: randomUUID(),
      cookie: adminCookie,
      status: 409,
    });
    await http(changePath, {
      method: 'PATCH',
      body: { ...shipBody, reason: 'Changed command' },
      key: shipCommand.key,
      cookie: adminCookie,
      status: 409,
    });
    const pendingShipment = (
      await orders.outbox.findFirstOrThrow({
        where: {
          eventName: 'OrderShipped',
          payload: { path: ['payload', 'orderId'], equals: fulfillment.order.id },
        },
      })
    ).payload;
    const failingStock = new PrismaStockStore(
      catalog.$extends({
        query: {
          outbox: {
            create() {
              throw new Error('injected stock acknowledgement failure');
            },
          },
        },
      }),
    );
    await assert.rejects(() => failingStock.apply(pendingShipment));
    assert.equal(
      (await catalog.inventory.findUniqueOrThrow({ where: { productId: product.id } })).stockGrams,
      beforeTea.stockGrams,
    );
    assert.equal(
      (
        await catalog.stockReservation.findUniqueOrThrow({
          where: { orderId: fulfillment.order.id },
        })
      ).status,
      'RESERVED',
    );
    assert.equal(
      await catalog.stockMovement.count({ where: { orderId: fulfillment.order.id, type: 'SALE' } }),
      0,
    );
    assert.equal(
      await catalog.processedEvent.count({ where: { eventId: pendingShipment.eventId } }),
      0,
    );
  } finally {
    catalogProcess.kill('SIGCONT');
  }
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: fulfillment.order.id } }))
        .stockDeductedAt,
    'stock deduction acknowledgement',
  );
  const afterTea = await catalog.inventory.findUniqueOrThrow({ where: { productId: product.id } });
  const afterPiece = await catalog.inventory.findUniqueOrThrow({ where: { productId: gaiwan.id } });
  assert.equal(afterTea.stockGrams, beforeTea.stockGrams - 50);
  assert.equal(afterTea.reservedGrams, beforeTea.reservedGrams - 50);
  assert.equal(afterPiece.stockPieces, beforePiece.stockPieces - 1);
  assert.equal(afterPiece.reservedPieces, beforePiece.reservedPieces - 1);
  const shipment = (
    await orders.outbox.findFirstOrThrow({
      where: {
        eventName: 'OrderShipped',
        payload: { path: ['payload', 'orderId'], equals: fulfillment.order.id },
      },
    })
  ).payload;
  await publish(shipment, 'orders.order_shipped');
  await publish({ ...shipment, eventId: randomUUID() }, 'orders.order_shipped');
  await publish(
    event('OrderCancelled', fulfillment.order.id, { reason: 'CUSTOMER' }),
    'orders.order_cancelled',
  );
  await waitFor(
    async () =>
      (await catalog.processedEvent.count({ where: { eventId: shipment.eventId } })) === 1,
    'duplicate shipment',
  );
  const completeKey = randomUUID();
  const completeBody = {
    status: 'COMPLETED',
    expectedStatus: 'SHIPPED',
    reason: 'Demonstration delivered and COD collected',
  };
  const [completed] = await Promise.all([
    http(changePath, {
      method: 'PATCH',
      body: completeBody,
      key: completeKey,
      cookie: adminCookie,
    }),
    http(changePath, {
      method: 'PATCH',
      body: completeBody,
      key: completeKey,
      cookie: adminCookie,
    }),
  ]);
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.paymentStatus, 'PAID');
  assert.equal(completed.actions.length, 2);
  assert.equal(completed.history.length, 4);
  const completion = await orders.outbox.count({
    where: {
      eventName: 'OrderCompleted',
      payload: { path: ['payload', 'orderId'], equals: fulfillment.order.id },
    },
  });
  assert.equal(completion, 1);
  await http(`/orders/${fulfillment.order.number}/cancel?token=${fulfillment.accessToken}`, {
    method: 'POST',
    body: {},
    status: 409,
  });
  const movements = await http(`/admin/orders/${fulfillment.order.id}/movements`, {
    cookie: adminCookie,
  });
  assert.equal(movements.total, 4);
  assert.equal(movements.items.filter((x) => x.type === 'SALE').length, 2);
  assert.ok(
    movements.items.some(
      (x) => x.unit === 'PIECE' && x.stockDelta === -1 && x.reservedDelta === -1,
    ),
  );
  await http(`/admin/orders/${fulfillment.order.id}/movements`, {
    cookie: await cookie(other),
    status: 403,
  });
  assert.equal(
    (await catalog.stockReservation.findUniqueOrThrow({ where: { orderId: fulfillment.order.id } }))
      .status,
    'CONSUMED',
  );
  assert.equal(
    (await catalog.inventory.findUniqueOrThrow({ where: { productId: product.id } })).stockGrams,
    afterTea.stockGrams,
  );
  // An unavailable acknowledgement cannot be bypassed by a completion command.
  await assert.rejects(() =>
    adminStore.transition({ ...shipCommand, key: randomUUID() }, actor, randomUUID()),
  );
  // Cancellation and shipment share the same order lock: exactly one can win.
  const race = await localStore.create(
    body,
    { idempotencyKey: randomUUID(), correlationId: randomUUID() },
    quote,
  );
  await statusOf(race, 'CONFIRMED');
  const outcomes = await Promise.allSettled([
    adminStore.transition(
      {
        id: race.order.id,
        status: 'SHIPPED',
        expectedStatus: 'CONFIRMED',
        reason: 'Race demonstration',
        key: randomUUID(),
      },
      actor,
      randomUUID(),
    ),
    localStore.cancel({ number: race.order.number, token: race.accessToken }, randomUUID()),
  ]);
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
  const raceRow = await orders.order.findUniqueOrThrow({ where: { id: race.order.id } });
  if (raceRow.status === 'SHIPPED')
    await waitFor(
      async () =>
        (await orders.order.findUniqueOrThrow({ where: { id: race.order.id } })).stockDeductedAt,
      'race deduction',
    );
  else {
    assert.equal(raceRow.status, 'CANCELLED');
    await waitFor(
      async () =>
        (await catalog.stockReservation.findUniqueOrThrow({ where: { orderId: race.order.id } }))
          .status === 'RELEASED',
      'race release',
    );
  }
  // Historical reservations stored grams rather than explicit units; shipment still consumes them once.
  const oldShape = await localStore.create(
    body,
    { idempotencyKey: randomUUID(), correlationId: randomUUID() },
    quote,
  );
  await statusOf(oldShape, 'CONFIRMED');
  await catalog.stockReservation.update({
    where: { orderId: oldShape.order.id },
    data: { items: [{ productId: product.id, grams: 25 }] },
  });
  await adminStore.transition(
    {
      id: oldShape.order.id,
      status: 'SHIPPED',
      expectedStatus: 'CONFIRMED',
      reason: 'Legacy reservation shipment',
      key: randomUUID(),
    },
    actor,
    randomUUID(),
  );
  await waitFor(
    async () =>
      (await orders.order.findUniqueOrThrow({ where: { id: oldShape.order.id } })).stockDeductedAt,
    'legacy deduction',
  );
  assert.equal(
    await catalog.stockMovement.count({
      where: { orderId: oldShape.order.id, type: 'SALE', unit: 'GRAM', quantity: 25 },
    }),
    1,
  );
  // Permanent malformed event is retried then quarantined instead of blocking a queue.
  await publish({ bad: true }, 'orders.order_created.v2');
  await waitFor(async () => {
    const q = await channel.checkQueue(`${namespace}.catalog.order_created_v2.dlq`);
    return q.messageCount > 0;
  }, 'dead letter');
  console.log(
    'Orders integration passed: clean migrations, repeatable seed, fresh prices, validation, concurrent idempotency, private guest/owner access, server carts, confirmed reservation, duplicate/reordered events, rollback, no oversell, rejection, cancellation, timeout, SMTP receipt, mixed gram/piece carts, atomic last-piece competition, legacy v1 compatibility, verified guest linking, private history, proof cutoff/reconciliation, neutral lookup, ADMIN list/detail role checks, secret exclusion, literal filters, stable pagination, audited/idempotent shipment and COD completion, atomic rollback, mixed stock deduction, acknowledgement, movement journal and DLQ.',
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
